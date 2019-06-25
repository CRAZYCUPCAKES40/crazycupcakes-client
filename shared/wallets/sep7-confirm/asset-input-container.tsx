import AssetInput, {Props} from '../send-form/asset-input/index'
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'

const mapStateToProps = (state: Container.TypedState) => {
  const currency = 'XLM'
  return {
    bottomLabel: `Your primary account has ${state.wallets.sep7ConfirmInfo.availableToSendNative} available to send.`,
    currencyLoading: false,
    displayUnit: Constants.getCurrencyAndSymbol(state, currency) || currency,
    inputPlaceholder: currency !== 'XLM' ? '0.00' : '0.0000000',
    numDecimalsAllowed: currency !== 'XLM' ? 2 : 7,
    topLabel: '',
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onChangeDisplayUnit: undefined, // Add when non-native assets are supported
})

const AssetInputWrapper = (props: Props) => {
  const [amount, onChangeAmount] = React.useState('')
  return <AssetInput {...props} value={amount} onChangeAmount={onChangeAmount} />
}

const AssetInputContainer = Container.namedConnect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => ({
  bottomLabel: stateProps.bottomLabel,
  currencyLoading: stateProps.currencyLoading,
  displayUnit: stateProps.displayUnit,
  inputPlaceholder: stateProps.inputPlaceholder,
  numDecimalsAllowed: stateProps.numDecimalsAllowed,
  onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
  topLabel: stateProps.topLabel,
}), 'AssetInput')(AssetInputWrapper)

export default AssetInputContainer