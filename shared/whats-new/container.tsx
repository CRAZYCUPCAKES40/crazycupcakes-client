import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import openURL from '../util/open-url'
import {getSeenVersions, keybaseFM} from '../constants/whats-new'
import WhatsNew from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  lastSeenVersion: state.config.whatsNewLastSeenVersion,
})
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  // Navigate primary/secondary button click
  _onNavigate: (props: {}, selected: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props, selected}],
      })
    )
  },
  _onNavigateExternal: (url: string) => openURL(url),
})
const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>
) => {
  const seenVersions = getSeenVersions('0.0.0')
  return {
    onNavigate: dispatchProps._onNavigate,
    onNavigateExternal: dispatchProps._onNavigateExternal,
    seenVersions,
  }
}

// @ts-ignore
WhatsNew.navigationOptions = Container.isMobile
  ? {
      HeaderTitle: keybaseFM,
      header: undefined,
      title: keybaseFM,
    }
  : undefined

const WhatsNewContainer = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'WhatsNewContainer'
)(WhatsNew)

export default WhatsNewContainer
