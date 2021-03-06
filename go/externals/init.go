package externals

import (
	libkb "github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/merklestore"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

// NewParamProofStore creates a new source and installs it into G.
func NewParamProofStoreAndInstall(g *libkb.GlobalContext) libkb.MerkleStore {
	supportedVersion := keybase1.MerkleStoreSupportedVersion(SupportedVersion)
	tag := "paramproofs"
	endpoint := "merkle/proof_params"
	getHash := func(root libkb.MerkleRoot) string {
		return root.ProofServicesHash()
	}
	kitFilename := g.Env.GetParamProofKitFilename()
	s := merklestore.NewMerkleStore(g, tag, endpoint, kitFilename, supportedVersion, getHash)
	g.SetParamProofStore(s)
	return s
}

func NewGlobalContextInit() *libkb.GlobalContext {
	g := libkb.NewGlobalContext().Init()
	g.SetProofServices(NewProofServices(g))
	g.ConfigureMerkleClient()
	pvl.NewPvlSourceAndInstall(g)
	NewParamProofStoreAndInstall(g)
	return g
}
