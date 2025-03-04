import { createSlice, Dictionary, EntityState, PayloadAction } from '@reduxjs/toolkit'
import { channelMessagesAdapter } from '../publicChannels/publicChannels.adapter'
import { ChannelMessage, IncomingMessages, instanceOfChannelMessage } from '../publicChannels/publicChannels.types'
import { StoreKeys } from '../store.keys'
import {
  messageVerificationStatusAdapter,
  messageSendingStatusAdapter,
  publicChannelsMessagesBaseAdapter
} from './messages.adapter.ts'
import {
  MessageVerificationStatus,
  MessageSendingStatus,
  PublicKeyMappingPayload,
  WriteMessagePayload,
  PublicChannelsMessagesBase,
  AddPublicChannelsMessagesBasePayload,
  SetDisplayedMessagesNumberPayload,
  LazyLoadingPayload,
  AskForMessagesPayload,
  ChannelMessagesIdsResponse
} from './messages.types'

export class MessagesState {
  public publicKeyMapping: Dictionary<CryptoKey> = {}

  public publicChannelsMessagesBase: EntityState<PublicChannelsMessagesBase> =
  publicChannelsMessagesBaseAdapter.getInitialState()

  public messageVerificationStatus: EntityState<MessageVerificationStatus> =
  messageVerificationStatusAdapter.getInitialState()

  public messageSendingStatus: EntityState<MessageSendingStatus> =
  messageSendingStatusAdapter.getInitialState()
}

export const messagesSlice = createSlice({
  initialState: { ...new MessagesState() },
  name: StoreKeys.Messages,
  reducers: {
    sendMessage: (state, _action: PayloadAction<WriteMessagePayload>) => state,
    addPublicKeyMapping: (state, action: PayloadAction<PublicKeyMappingPayload>) => {
      state.publicKeyMapping[action.payload.publicKey] = action.payload.cryptoKey
    },
    addPublicChannelsMessagesBase: (state, action: PayloadAction<AddPublicChannelsMessagesBasePayload>) => {
      const { channelAddress } = action.payload
      publicChannelsMessagesBaseAdapter.addOne(state.publicChannelsMessagesBase, {
        channelAddress: channelAddress,
        messages: channelMessagesAdapter.getInitialState(),
        display: 50
      })
    },
    addMessageVerificationStatus: (state, action: PayloadAction<MessageVerificationStatus>) => {
      const status = action.payload
      messageVerificationStatusAdapter.upsertOne(state.messageVerificationStatus, status)
    },
    addMessagesSendingStatus: (state, action: PayloadAction<MessageSendingStatus>) => {
      const status = action.payload
      messageSendingStatusAdapter.upsertOne(state.messageSendingStatus, status)
    },
    removePendingMessageStatus: (state, action: PayloadAction<string>) => {
      const id = action.payload
      messageSendingStatusAdapter.removeOne(state.messageSendingStatus, id)
    },
    incomingMessages: (state, action: PayloadAction<IncomingMessages>) => {
      const { messages } = action.payload
      for (const message of messages) {
        if (!instanceOfChannelMessage(message)) return

        let incoming = message

        const draft = state.publicChannelsMessagesBase
          .entities[message.channelAddress]
          ?.messages
          .entities[message.id]

        if (message.media && draft?.media.path) {
          incoming = {
            ...message,
            media: {
              ...message.media,
              path: message.media.path ? message.media.path : draft.media.path
            }
          }
        }

        channelMessagesAdapter.upsertOne(
          state.publicChannelsMessagesBase.entities[message.channelAddress].messages,
          incoming
        )
      }
    },
    setDisplayedMessagesNumber: (state, action: PayloadAction<SetDisplayedMessagesNumberPayload>) => {
      const { display, channelAddress } = action.payload
      publicChannelsMessagesBaseAdapter.updateOne(
        state.publicChannelsMessagesBase, {
          id: channelAddress,
          changes: {
            display: display
          }
        }
      )
    },
    askForMessages: (state, _action: PayloadAction<AskForMessagesPayload>) =>
      state,
    responseSendMessagesIds: (
      state,
      _action: PayloadAction<ChannelMessagesIdsResponse>
    ) => state,
    lazyLoading: (state, _action: PayloadAction<LazyLoadingPayload>) => state,
    extendCurrentPublicChannelCache: (state) => state,
    resetCurrentPublicChannelCache: (state) => state,
    // Utility action for testing purposes
    test_message_verification_status: (
      state,
      action: PayloadAction<{
        message: ChannelMessage
        verified: boolean
      }>
    ) => {
      const { message, verified } = action.payload
      messageVerificationStatusAdapter.upsertOne(state.messageVerificationStatus, {
        publicKey: message.pubKey,
        signature: message.signature,
        verified: verified
      })
    }
  }
})

export const messagesActions = messagesSlice.actions
export const messagesReducer = messagesSlice.reducer
