require("@nomicfoundation/hardhat-toolbox");

const FLARE_MAINNET_RPC = process.env.FLARE_MAINNET_RPC || "https://flare-api.flare.network/ext/C/rpc";
const FLARE_COSTON2_RPC = process.env.FLARE_COSTON2_RPC || "https://coston2-api.flare.network/ext/C/rpc";

module.exports = {
  solidity: "0.8.24",
  networks: {
    flare: {
      url: FLARE_MAINNET_RPC,
      chainId: 14
    },
    coston2: {
      url: FLARE_COSTON2_RPC,
      chainId: 114
    }
  }
};
