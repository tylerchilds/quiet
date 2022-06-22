import assert from 'assert'
import { AsyncReturnType } from '../types/AsyncReturnType.interface'
import { createApp, getRandomInt, sleep } from '../utils'
import { TestStore } from '@quiet/state-manager'
import { LoremIpsum } from 'lorem-ipsum'
import { program } from 'commander'
import { registerUsername, switchChannel, sendMessage } from '../testUtils/actions'
import { waitForExpect } from '../testUtils/waitForExpect'
import { assertReceivedChannel } from '../testUtils/assertions'

import logger from '../logger'
const log = logger('bot')

program
  .requiredOption('-r, --registrar <string>', 'Address of community')
  .option('-c, --channel <string>', 'Channel name for spamming messages', 'spam-bot')
  .requiredOption('-m, --messages <number>', 'Number of all messages that will be sent to a channel')
  .option('-u, --activeUsers <number>', 'Number of spamming users (bots)', '3')
  .option('-s, --silentUsers <number>', 'Number of extra peers (bots)', '0')
  .option('-i, --intensity <number>', 'Number of messages per minute')

program.parse()
const options = program.opts()

const lorem = new LoremIpsum({
  wordsPerSentence: {
    max: 16,
    min: 1
  }
})

// Global config
const apps: Map<string, AsyncReturnType<typeof createApp>> = new Map()
const timeout = 100_000
const channelName = options.channel
const registrarAddress = options.registrar
const messages = options.messages
const activeUsers = options.activeUsers
const silentUsers = options.silentUsers
const intensity = options.intensity

let typingLatency: number = undefined

if (intensity) {
  typingLatency = (messages / intensity) * 1000 / messages // Typing latency per message (in milliseconds)
}

const createBots = async () => {
  log(`Creating ${activeUsers} bots`)
  for (let i = 0; i < activeUsers; i++) {
    let username = `bot_${(Math.random() + 1).toString(36).substring(5)}`
    apps.set(username, await createApp())
  }
}

const createSilentBots = async () => {
  log(`Creating ${silentUsers} silent bots`)
  for (let i = 0; i < silentUsers; i++) {
    let username = `silent_bot_${(Math.random() + 1).toString(36).substring(5)}`
    apps.set(username, await createApp())
  }
}

const registerBots = async () => {
  for (const [username, app] of apps) {
      const store = app.store
      const payload = {
        registrarAddress,
        userName: username,
        registrarPort: null,
        store
      }

      log(`Registering ${username}`)

      await registerUsername(payload)
  
      const communityId = store.getState().Communities.communities.ids[0]
  
      await waitForExpect(() => {
        assert.ok(store.getState().Identity.identities.entities[communityId].userCertificate, `User ${username} did not receive certificate`)
      }, timeout)

      log('After wait for expect')

      await assertReceivedChannel(username, channelName, timeout, store)

      log('After assert received channel')

      await switchChannel({ channelName, store })
    }
}

const sendMessages = async () => {
  /**
   * Split all messages between the bots and send them in random order
   */
  log(`Start sending ${messages} messages`)
  const activeUsers: Map<string, AsyncReturnType<typeof createApp>> = new Map()
  apps.forEach((app, username) => {
    if (!username.includes('silent')) {
      activeUsers.set(username, app)
    }
  })
  const messagesPerUser = Math.floor(messages / activeUsers.size)

  const messagesToSend = new Map()
  for (const [username, _app] of activeUsers) {
    messagesToSend.set(username, messagesPerUser)
  }

  while (messagesToSend.size > 0) {
    const usernames = Array.from(messagesToSend.keys())
    const currentUsername = usernames[Math.floor(Math.random() * usernames.length)]
    let messagesLeft = messagesToSend.get(currentUsername)
    messagesLeft -= 1

    if (messagesLeft <= 0) {
      await sendMessageWithLatency(currentUsername, apps.get(currentUsername).store, 'Bye!')
      messagesToSend.delete(currentUsername)
      log(`User ${currentUsername} is finished with sending messages.`)
      continue
    }

    await sendMessageWithLatency(currentUsername, apps.get(currentUsername).store, `(${messagesLeft}) ${lorem.generateSentences(1)}`)
    messagesToSend.set(currentUsername, messagesLeft)
  }

  await sleep(10_000)
}

const sendMessageWithLatency = async (
  username: string, 
  store: TestStore, 
  message: string
) => {
  const latency = typingLatency || getRandomInt(300, 550)
  log(`${username} is waiting ${latency}ms to send a message`)
  await sleep(latency)
  await sendMessage({
    message,
    channelName,
    store
  })
}

const closeAll = async () => {
  for (const [_username, app] of apps) {
    await app.manager.closeAllServices()
  }
}

const run = async () => {
  process.on('unhandledRejection', async (error) => {
    console.error(error)
    await closeAll()
  })
  process.on('SIGINT', async () => {
    log('\nGracefully shutting down from SIGINT (Ctrl-C)')
    await closeAll()
  })
  await createBots()
  await registerBots()
  await sendMessages()
  await closeAll()
}

run().then(() => {
  console.log('FINISHED')
}).catch((e) => console.error(e))
