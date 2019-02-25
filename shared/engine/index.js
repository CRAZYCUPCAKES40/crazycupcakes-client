// @flow
// Handles sending requests to the daemon
import logger from '../logger'
import Session from './session'
import * as ConfigGen from '../actions/config-gen'
import {initEngine, initEngineSaga} from './require'
import {convertToError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {localLog} from '../util/forward-logs'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {resetClient, createClient, rpcLog} from './index.platform'
import {createBatchChangeWaiting} from '../actions/waiting-gen'
import engineSaga from './saga'
import {isArray, throttle} from 'lodash-es'
import {sagaMiddleware} from '../store/configure-store'
import type {Effect} from 'redux-saga'
import type {CancelHandlerType} from './session'
import type {createClientType} from './index.platform'
import type {CustomResponseIncomingCallMapType, IncomingCallMapType} from '.'
import type {SessionID, SessionIDKey, WaitingHandlerType, MethodKey} from './types'
import type {TypedState, Dispatch} from '../util/container'
import type {RPCError} from '../util/errors'

// Not the real type here to reduce merge time. This file has a .js.flow for importers
type WaitingKey = string | Array<string>

type CustomResponseIncomingActionCreator = (
  param: Object,
  response: Object,
  state: TypedState
) => Effect | null | void | false | Array<Effect | null | void | false>

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

class Engine {
  // Bookkeep old sessions
  _deadSessionsMap: {[key: SessionIDKey]: true} = {}
  // Tracking outstanding sessions
  _sessionsMap: {[key: SessionIDKey]: Session} = {}
  // Helper we delegate actual calls to
  _rpcClient: createClientType
  // All incoming call handlers
  _customResponseIncomingActionCreators: {
    [key: MethodKey]: CustomResponseIncomingActionCreator,
  } = {}
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = isMobile // mobile is always connected
  // App tells us when the sagas are done loading so we can start emitting events
  _sagasAreReady: boolean = false
  // So we can dispatch actions
  static _dispatch: Dispatch
  // Temporary helper for incoming call maps
  static _getState: () => TypedState

  _queuedChanges = []
  dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error: RPCError) => {
    this._queuedChanges.push({error, increment: waiting, key})
    this._throttledDispatchWaitingAction()
  }

  _throttledDispatchWaitingAction = throttle(() => {
    const changes = this._queuedChanges
    this._queuedChanges = []
    Engine._dispatch(createBatchChangeWaiting({changes}))
  }, 500)

  // TODO deprecate
  deprecatedGetDispatch = () => {
    return Engine._dispatch
  }
  // TODO deprecate
  deprecatedGetGetState = () => {
    return Engine._getState
  }

  constructor(dispatch: Dispatch, getState: () => TypedState) {
    // setup some static vars
    Engine._dispatch = dispatch
    Engine._getState = getState
    this._setupClient()
    this._setupIgnoredHandlers()
    this._setupDebugging()
  }

  _setupClient() {
    this._rpcClient = createClient(
      payload => this._rpcIncoming(payload),
      () => this._onConnected(),
      () => this._onDisconnect()
    )
  }

  _setupDebugging() {
    if (!__DEV__) {
      return
    }

    if (typeof window !== 'undefined') {
      logger.info('DEV MODE ENGINE AVAILABLE AS window.DEBUGengine')
      window.DEBUGengine = this
    }

    // Print out any alive sessions periodically
    if (printOutstandingRPCs) {
      setInterval(() => {
        if (Object.keys(this._sessionsMap).filter(k => !this._sessionsMap[k].getDangling()).length) {
          localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  _setupIgnoredHandlers() {
    // Any messages we want to ignore go here
  }

  _onDisconnect() {
    Engine._dispatch({payload: undefined, type: 'engine-gen:disconnected'})
  }

  // We want to dispatch the connect action but only after sagas boot up
  sagasAreReady = () => {
    this._sagasAreReady = true
    if (this._hasConnected) {
      // dispatch the action version
      Engine._dispatch({payload: undefined, type: 'engine-gen:connected'})
    }
  }

  // Called when we reconnect to the server
  _onConnected() {
    this._hasConnected = true

    // Sagas already booted so they can get this
    if (this._sagasAreReady) {
      // dispatch the action version
      Engine._dispatch({payload: undefined, type: 'engine-gen:connected'})
    }
  }

  // Create and return the next unique session id
  _generateSessionID(): number {
    this._nextSessionID++
    return this._nextSessionID
  }

  // Got a cancelled sequence id
  _handleCancel(seqid: number) {
    const cancelledSessionID = Object.keys(this._sessionsMap).find(key =>
      this._sessionsMap[key].hasSeqID(seqid)
    )
    if (cancelledSessionID) {
      const s = this._sessionsMap[cancelledSessionID]
      rpcLog({
        extra: {cancelledSessionID},
        method: s._startMethod || 'unknown',
        reason: '[cancel]',
        type: 'engineInternal',
      })
      s.cancel()
    } else {
      rpcLog({
        extra: {cancelledSessionID},
        method: 'unknown',
        reason: '[cancel?]',
        type: 'engineInternal',
      })
    }
  }

  // An incoming rpc call
  _rpcIncoming(payload: {method: MethodKey, param: Array<Object>, response: ?Object}) {
    const {method, param: incomingParam, response} = payload
    const param = incomingParam && incomingParam.length ? incomingParam[0] : {}
    const {seqid, cancelled} = response || {cancelled: false, seqid: 0}
    const {sessionID} = param

    if (cancelled) {
      this._handleCancel(seqid)
    } else {
      const session = this._sessionsMap[String(sessionID)]
      if (session && session.incomingCall(method, param, response)) {
        // Part of a session?
        // _customResponseIncomingActionCreators will just be a set of method strings which engine will rely on listeners to handle themselves
      } else if (this._customResponseIncomingActionCreators[method]) {
        // General incoming :: TODO deprecate
        rpcLog({method, reason: '[incoming]', type: 'engineInternal'})

        if (!response) {
          throw new Error("Expected response but there isn't any" + method)
        }
        let creator = this._customResponseIncomingActionCreators[method]
        let rawEffects = creator(param, response, Engine._getState())

        const effects = (isArray(rawEffects) ? rawEffects : [rawEffects]).filter(Boolean)
        effects.forEach(effect => {
          let thrown
          sagaMiddleware.run(function*(): Generator<any, any, any> {
            try {
              yield effect
            } catch (e) {
              thrown = e
            }
          })
          if (thrown) {
            Engine._dispatch(ConfigGen.createGlobalError({globalError: thrown}))
          }
        })
      } else {
        // Dispatch as an action
        // Handle it by default
        response && response.result()
        const type = method
          .replace(/'/g, '')
          .split('.')
          .map((p, idx) => (idx ? capitalize(p) : p))
          .join('')
        // $ForceType can't really type this easily
        Engine._dispatch({payload: {params: param}, type: `engine-gen:${type}`})
      }
    }
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _rpcOutgoing(p: {
    method: string,
    params: Object,
    callback: (...args: Array<any>) => void,
    incomingCallMap?: any, // IncomingCallMapType, actually a mix of all the incomingcallmap types, which we don't handle yet TODO we could mix them all
    customResponseIncomingCallMap?: any,
    waitingKey?: WaitingKey,
  }) {
    // Make a new session and start the request
    const session = this.createSession({
      customResponseIncomingCallMap: p.customResponseIncomingCallMap,
      incomingCallMap: p.incomingCallMap,
      waitingKey: p.waitingKey,
    })
    // Don't make outgoing calls immediately since components can do this when they mount
    setImmediate(() => {
      session.start(p.method, p.params, p.callback)
    })
    return session.getId()
  }

  // Make a new session. If the session hangs around forever set dangling to true
  createSession(p: {
    incomingCallMap?: ?IncomingCallMapType,
    customResponseIncomingCallMap?: ?CustomResponseIncomingCallMapType,
    cancelHandler?: CancelHandlerType,
    dangling?: boolean,
    waitingKey?: WaitingKey,
  }): Session {
    const {customResponseIncomingCallMap, incomingCallMap, cancelHandler, dangling = false, waitingKey} = p
    const sessionID = this._generateSessionID()

    const session = new Session({
      cancelHandler,
      customResponseIncomingCallMap,
      dangling,
      endHandler: (session: Session) => this._sessionEnded(session),
      incomingCallMap,
      invoke: (method, param, cb) => {
        const callback = method => (...args) => {
          // If first argument is set, convert it to an Error type
          if (args.length > 0 && !!args[0]) {
            args[0] = convertToError(args[0], method)
          }
          cb(...args)
        }
        this._rpcClient.invoke(method, param || [{}], callback(method))
      },
      sessionID,
      waitingKey,
    })

    this._sessionsMap[String(sessionID)] = session
    return session
  }

  // Cancel a session
  cancelSession(sessionID: SessionID) {
    const session = this._sessionsMap[String(sessionID)]
    if (session) {
      session.cancel()
    }
  }

  // Cleanup a session that ended
  _sessionEnded(session: Session) {
    rpcLog({
      extra: {
        sessionID: session.getId(),
      },
      method: session._startMethod || 'unknown',
      reason: '[-session]',
      type: 'engineInternal',
    })
    delete this._sessionsMap[String(session.getId())]
    this._deadSessionsMap[String(session.getId())] = true
  }

  // Reset the engine
  reset() {
    // TODO not working on mobile yet
    if (isMobile) {
      return
    }
    resetClient(this._rpcClient)
  }

  // Setup a handler for a rpc w/o a session (id = 0). We don't allow overlapping keys
  setCustomResponseIncomingCallMap(customResponseIncomingCallMap: any): void {
    Object.keys(customResponseIncomingCallMap).forEach(method => {
      if (this._customResponseIncomingActionCreators[method]) {
        rpcLog({
          method,
          reason: "duplicate incoming action creator!!! this isn't allowed",
          type: 'engineInternal',
        })
        return
      }
      rpcLog({
        method,
        reason: '[register]',
        type: 'engineInternal',
      })
      this._customResponseIncomingActionCreators[method] = customResponseIncomingCallMap[method]
    })
  }

  // Register a named callback when we fail to connect. Call if we're already disconnected
  hasEverConnected() {
    // If we've actually failed to connect already let's call this immediately
    return this._hasConnected
  }
}

// Dummy engine for snapshotting
class FakeEngine {
  _deadSessionsMap: {[key: SessionIDKey]: Session} // just to bookkeep
  _sessionsMap: {[key: SessionIDKey]: Session}
  constructor() {
    logger.info('Engine disabled!')
    this._sessionsMap = {}
  }
  reset() {}
  cancelSession(sessionID: SessionID) {}
  rpc() {}
  setFailOnError() {}
  hasEverConnected() {}
  setIncomingActionCreator(
    method: MethodKey,
    actionCreator: ({param: Object, response: ?Object, state: any}) => ?any
  ) {}
  createSession(
    incomingCallMap: ?IncomingCallMapType,
    waitingHandler: ?WaitingHandlerType,
    cancelHandler: ?CancelHandlerType,
    dangling?: boolean = false
  ) {
    return new Session({
      endHandler: () => {},
      incomingCallMap: null,
      invoke: () => {},
      sessionID: 0,
    })
  }
  _channelMapRpcHelper(configKeys: Array<string>, method: string, params: any): any {
    return null
  }
  _rpcOutgoing(
    method: string,
    params: ?{
      incomingCallMap?: any, // IncomingCallMapType, actually a mix of all the incomingcallmap types, which we don't handle yet TODO we could mix them all
      waitingHandler?: WaitingHandlerType,
    },
    callback: (...args: Array<any>) => void
  ) {}
}

// don't overwrite this on HMR
let engine = global._engine
const makeEngine = (dispatch: Dispatch, getState: () => TypedState) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine = process.env.KEYBASE_NO_ENGINE || isTesting ? new FakeEngine() : new Engine(dispatch, getState)
    global._engine = engine
    initEngine((engine: any))
    initEngineSaga(engineSaga)
  }
  return engine
}

const getEngine = (): Engine | FakeEngine => {
  if (__DEV__ && !engine) {
    throw new Error('Engine needs to be initialized first')
  }
  return engine
}

export default getEngine
export {getEngine, makeEngine, Engine}
