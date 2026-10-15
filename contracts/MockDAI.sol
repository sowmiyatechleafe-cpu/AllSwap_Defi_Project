 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDAI is ERC20 {
    constructor() ERC20("Mock Dai Stablecoin", "mDAI") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
 
