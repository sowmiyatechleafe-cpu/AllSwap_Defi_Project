// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PilotSwap {
    IERC20 public pilotToken;
    IERC20 public usdcToken;

    uint256 public pilotPrice = 1;

    constructor(address _pilotToken, address _usdcToken) {
        pilotToken = IERC20(_pilotToken);
        usdcToken = IERC20(_usdcToken);
    }

    function swapUSDCForPilot(uint256 usdcAmount) external {
        uint256 pilotAmount = usdcAmount * pilotPrice;

        require(
            usdcToken.transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transfer failed"
        );

        require(
            pilotToken.transfer(msg.sender, pilotAmount),
            "PILOT transfer failed"
        );
    }

    function swapPilotForUSDC(uint256 pilotAmount) external {
        uint256 usdcAmount = pilotAmount / pilotPrice;

        require(
            pilotToken.transferFrom(msg.sender, address(this), pilotAmount),
            "PILOT transfer failed"
        );

        require(
            usdcToken.transfer(msg.sender, usdcAmount),
            "USDC transfer failed"
        );
    }
}