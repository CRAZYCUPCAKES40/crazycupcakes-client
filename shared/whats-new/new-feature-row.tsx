import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {FeatureWithSeenState} from '../constants/types/whats-new'

type Props = FeatureWithSeenState & {
  noSeparator?: boolean
  onPrimaryButtonClick?: () => void
  onSecondaryButtonClick?: () => void
  imageStyle?: Styles.StylesCrossPlatform
}

const NewFeature = (props: Props) => {
  const primaryButton = props.primaryButtonText ? (
    <Kb.Button
      type="Default"
      mode="Primary"
      label={props.primaryButtonText}
      style={styles.buttons}
      onClick={props.onPrimaryButtonClick}
    />
  ) : null

  const secondaryButton =
    props.primaryButtonText && props.secondaryButtonText ? (
      <Kb.Button
        type="Default"
        mode="Secondary"
        label={props.secondaryButtonText}
        style={styles.buttons}
        onClick={props.onSecondaryButtonClick}
      />
    ) : null
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.rowContainer,
        props.noSeparator ? {marginTop: 0} : {marginTop: Styles.globalMargins.tiny},
      ])}
    >
      {/* Badging */}
      {!props.seen && (
        <Kb.Badge height={8} badgeStyle={styles.badgeStyle} containerStyle={styles.badgeContainerStyle} />
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
        <Kb.Text type="Body">{props.text}</Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.imageContainer}>
          {props.image && (
            <Kb.RequireImage
              src={props.image}
              style={Styles.collapseStyles([styles.image, props.imageStyle])}
            />
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.buttonRowContainer} gap="xtiny">
          {primaryButton}
          {secondaryButton}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  badgeContainerStyle: {
    color: Styles.globalColors.transparent,
  },
  badgeStyle: {
    backgroundColor: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.xsmall,
    marginTop: 13,
  },
  buttonRowContainer: {
    alignSelf: 'flex-start',
    justifyContent: 'space-between',
  },
  buttons: {
    // Apply margins to buttons so that when they wrap there is vertical space between them
    marginTop: Styles.globalMargins.xsmall,
  },
  contentContainer: {
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  rowContainer: {
    ...Styles.globalStyles.fullWidth,
    alignSelf: 'flex-start',
  },
  image: {
    alignSelf: 'center',
    maxHeight: 96,
    maxWidth: 216,
  },
  imageContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default NewFeature
