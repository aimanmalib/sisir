// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract Clean {
    uint256 public count;

    function bump() external {
        count += 1;
    }
}
