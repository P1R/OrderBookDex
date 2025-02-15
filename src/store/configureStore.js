import { createStore, applyMiddleware, compose } from 'redux'
import { createLogger } from 'redux-logger'
import rootReducer from './reducers'

const loggerMiddleware = createLogger()
const middleware = []

// For redux dev tools
const composeEnchacers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

export default function configureStore(preloadedState){
  return createStore(
    rootReducer,
    preloadedState,
    composeEnchacers(applyMiddleware(...middleware, loggerMiddleware))
  )
}
