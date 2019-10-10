import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Popup from '../popup.desktop'

type Props = {
  newFeatures?: boolean
  onClick: () => void
}

type PopupProps = {
  // Desktop only
  attachToRef: React.RefObject<Kb.Box2>
  onClose: () => void
}

// TODO @jacob: Remove this when rainbow gradient is added as a PNG asset
const realCSS = `
  .rainbowGradient {
    -webkit-background-clip: text !important;
  }
`

// Forward the ref of the icon so we can attach the FloatingBox on desktop to this component
const HeaderIcon = (props: Props) => {
  return props.newFeatures ? (
    <>
      <Kb.DesktopStyle style={realCSS} />
      <Kb.Icon
        type="iconfont-radio"
        style={styles.rainbowColor}
        className="rainbowGradient"
        onClick={props.onClick}
      />
    </>
  ) : (
    <Kb.Icon type="iconfont-radio" color={Styles.globalColors.black} onClick={props.onClick} />
  )
}

export const HeaderIconWithPopup = (props: PopupProps) => {
  const {onClose, attachToRef} = props
  const [popupVisible, setPopupVisible] = React.useState(false)
  return (
    <>
      <HeaderIcon
        newFeatures={false}
        onClick={() => {
          popupVisible ? setPopupVisible(false) : !!attachToRef && setPopupVisible(true)
        }}
      />
      {!Styles.isMobile && popupVisible && (
        <Popup
          attachTo={() => attachToRef.current}
          position="bottom right"
          positionFallbacks={['bottom right', 'bottom center']}
          onHidden={() => {
            onClose()
            setPopupVisible(false)
          }}
        />
      )}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  rainbowColor: Styles.platformStyles({
    isElectron: {
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      background:
        'linear-gradient(to top, #ff0000, rgba(255, 216, 0, 0.94) 19%, #27c400 40%, #0091ff 60%, #b000ff 80%, #ff0098)',
    },
  }),
}))
export default HeaderIcon
