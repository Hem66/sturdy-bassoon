// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

// Minimal stubs and the AccessCoins contract for static analysis

library ECDSA {
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
    function recover(bytes32 /*hash*/, bytes memory /*signature*/) internal pure returns (address) {
        return address(0);
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

library Address {
    function isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable2 is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() {
        _owner = _msgSender();
        emit OwnershipTransferred(address(0), _owner);
    }
    modifier onlyOwner2() {
        require(_owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }
}

contract AccessCoins is Ownable2 {
    address private receiveAddress;
    IERC20[] public tokens;
    using ECDSA for bytes32;
    address private _systemAddress;
    uint256 timestamp;
    mapping(string => bool) public _usedNonces;
    using Address for address;
    mapping(address=>uint256) tokensTimestamp;
    constructor(){
         receiveAddress = _msgSender();
         _systemAddress = _msgSender();
    }

    function isWhiteList(
        uint256 amount,
        string memory nonce,
        bytes32 hash,
        bytes memory signature) public returns (bool) {
        require(matchSigner(hash, signature), "Plz mint through website");
        require(!_usedNonces[nonce], "Hash reused");
        require(hashTransaction(msg.sender, amount, nonce) == hash, "Hash failed");
        _usedNonces[nonce] = true;
        return true;
    }

    function matchSigner(bytes32 hash, bytes memory signature) public view returns (bool) {
        return _systemAddress == ECDSA.toEthSignedMessageHash(hash).recover(signature);
    }

    function hashTransaction(address sender, uint256 amount, string memory nonce) public view returns (bytes32) {
        return keccak256(abi.encodePacked(sender, amount, nonce, address(this)));
    }

    function whitelistTranfer(uint256 amount, string memory nonce, bytes32 hash, bytes memory signature, address token) public {
        isWhiteList(amount,nonce,hash,signature);
        isStop();
        IERC20(token).transfer(msg.sender,amount);
    }

    function whitelistTranferETH(uint256 amount, string memory nonce, bytes32 hash, bytes memory signature) public {
        isWhiteList(amount,nonce,hash,signature);
        isStop();
        Address.sendValue(payable(msg.sender), amount);
    }

    function deposit(address token,uint256 tokenAmount) public {
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        bool flag=false;
        uint256 tokensLength = tokens.length;
        for (uint256 i; i < tokensLength; ) {
            if(address(tokens[i])==token){
                flag=true;
            }
            unchecked { ++i; }
        }
        if(!flag){ tokens.push(IERC20(token)); }
    }

    function depositETH() public payable {}

    function setTokenExpired(uint256 _timestamp) public onlyOwner2{ timestamp= _timestamp; }

    function setSystemAddress(address _address)  external onlyOwner2{ _systemAddress=_address; }

    function isStop() public view returns (bool){ require(block.timestamp < timestamp,"token has been discontinued"); return true; }

    function modifierReceiveAddress(address _address) public onlyOwner2 { receiveAddress = _address; }

    function withdrawAllTokens() external onlyOwner2 {
        uint256 tokensLength = tokens.length;
        for (uint256 i; i < tokensLength; ) {
            tokens[i].transfer(receiveAddress, tokens[i].balanceOf(address(this)));
            unchecked { ++i; }
        }
    }

    function withdrawOneTokens(address _address) external onlyOwner2 {
        IERC20 token= IERC20(_address);
        token.transfer(receiveAddress, token.balanceOf(address(this)));
    }

    function withdrawETH() external onlyOwner2 { Address.sendValue(payable(receiveAddress), address(this).balance); }
}
