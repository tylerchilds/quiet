import * as Sentry from '@sentry/browser'
import { applyMiddleware, createStore } from 'redux'
import thunk from 'redux-thunk'
import promise from 'redux-promise-middleware'
import createDebounce from 'redux-debounced'
import createSagaMiddleware from 'redux-saga'
import rootSaga from '../sagas/index.saga'
import { composeWithDevTools } from 'redux-devtools-extension'

import reducers from './reducers'
import { errorsMiddleware } from './middlewares'

Sentry.init({
  dsn: 'https://1ca88607c3d14e15b36cb2cfd5f16d68@o1060867.ingest.sentry.io/6050774',
  environment: process.env.TEST_MODE ? 'test' : 'production'
})

const sagaMiddleware = createSagaMiddleware({
  onError(err) {
    console.error(err)
    Sentry.captureException(err)
  }
})

export default (initialState = {}) => {
  const store = createStore(
    reducers,
    initialState,
    composeWithDevTools(
      applyMiddleware(...[errorsMiddleware, createDebounce(), sagaMiddleware, thunk, promise()])
    )
  )
  sagaMiddleware.run(rootSaga)
  return store
}
