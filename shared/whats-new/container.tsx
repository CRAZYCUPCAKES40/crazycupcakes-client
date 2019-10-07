import React from 'react'
import WhatsNew from '.'
import {currentVersion, lastVersion, lastLastVersion} from './releases'

/*
 * TODO Developer Notes
 *
 * 1. Make an RPC (ON OPEN) to gregor to get the user's last seen version string
 * 2. Make an RPC (ON CLOSE) to gregor to set the user's last seen version to the current one
 * 3. Read the releses JSON information
 * 4. Combining the latest version with the JSON information, set the "seen state"
 *
 */

const onNavigate = () => null
const Container = () => {
  return <WhatsNew onNavigate={onNavigate} />
}

export default Container
