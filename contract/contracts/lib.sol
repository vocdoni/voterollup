// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;


library SafeUint8 {
    /// @notice Adds two uint8 integers and fails if an overflow occurs
    function add8(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 c = a + b;
        require(c >= a, "overflow");

        return c;
    }
}


library ContractSupport {
    // Compatible contract functions signatures
    bytes4 private constant BALANCE_OF_ADDR = bytes4(
        keccak256("balanceOf(address)")
    );

    function isContract(address targetAddress) internal view returns (bool) {
        uint256 size;
        if (targetAddress == address(0)) return false;
        assembly {
            size := extcodesize(targetAddress)
        }
        return size > 0;
    }

    function isSupporting(address targetAddress, bytes memory data)
        private
        returns (bool)
    {
        bool success;
        assembly {
            success := call(
                gas(), // gas remaining
                targetAddress, // destination address
                0, // no ether
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data), // input length (loaded from the first 32 bytes in the `data` array)
                0, // output buffer
                0 // output length
            )
        }
        return success;
    }

    function supportsBalanceOf(address targetAddress) internal returns (bool) {
        bytes memory data = abi.encodeWithSelector(
            BALANCE_OF_ADDR,
            address(0x0)
        );
        return isSupporting(targetAddress, data);
    }
}

/**
* @author Hamdi Allam hamdi.allam97@gmail.com
* Please reach out with any questions or concerns
*/
library RLP {
    uint8 constant STRING_SHORT_START = 0x80;
    uint8 constant STRING_LONG_START  = 0xb8;
    uint8 constant LIST_SHORT_START   = 0xc0;
    uint8 constant LIST_LONG_START    = 0xf8;

    uint8 constant WORD_SIZE = 32;

    struct RLPItem {
        uint256 len;
        uint256 memPtr;
    }

    function toBoolean(RLPItem memory item) internal pure returns (bool) {
        require(item.len == 1, "Invalid RLPItem. Booleans are encoded in 1 byte");
        uint256 result;
        uint256 memPtr = item.memPtr;
        assembly {
            result := byte(0, mload(memPtr))
        }

        return result == 0 ? false : true;
    }

    function toAddress(RLPItem memory item) internal pure returns (address) {
        // 1 byte for the length prefix according to RLP spec
        require(item.len <= 21, "Invalid RLPItem. Addresses are encoded in 20 bytes or less");

        return address(toUint(item));
    }

    function toUint(RLPItem memory item) internal pure returns (uint256) {
        uint256 offset = _payloadOffset(item.memPtr);
        uint256 len = item.len - offset;
        uint256 memPtr = item.memPtr + offset;

        uint256 result;
        assembly {
            result := div(mload(memPtr), exp(256, sub(32, len))) // shift to the correct location
        }

        return result;
    }

    function toRLPBytes(RLPItem memory item) internal pure returns (bytes memory) {
        bytes memory result = new bytes(item.len);

        uint256 ptr;
        assembly {
            ptr := add(0x20, result)
        }

        _copy(item.memPtr, ptr, item.len);
        return result;
    }

    function toBytes(RLPItem memory item) internal pure returns (bytes memory) {
        uint256 offset = _payloadOffset(item.memPtr);
        uint256 len = item.len - offset; // data length
        bytes memory result = new bytes(len);

        uint256 destPtr;
        assembly {
            destPtr := add(0x20, result)
        }

        _copy(item.memPtr + offset, destPtr, len);
        return result;
    }

    function toRLPItem(bytes memory item) internal pure returns (RLPItem memory) {
        if (item.length == 0)
            return RLPItem(0, 0);

        uint256 memPtr;
        assembly {
            memPtr := add(item, 0x20)
        }

        return RLPItem(item.length, memPtr);
    }

    function toList(RLPItem memory item) internal pure returns (RLPItem[] memory result) {
        require(isList(item), "Cannot convert to list a non-list RLPItem.");

        uint256 items = numItems(item);
        result = new RLPItem[](items);

        uint256 memPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 dataLen;
        for (uint256 i = 0; i < items; i++) {
            dataLen = _itemLength(memPtr);
            result[i] = RLPItem(dataLen, memPtr);
            memPtr = memPtr + dataLen;
        }
    }

    function isList(RLPItem memory item) internal pure returns (bool) {
        uint8 byte0;
        uint256 memPtr = item.memPtr;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < LIST_SHORT_START)
            return false;
        return true;
    }

    function numItems(RLPItem memory item) internal pure returns (uint256) {
        uint256 count = 0;
        uint256 currPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            currPtr = currPtr + _itemLength(currPtr); // skip over an item
            count++;
        }

        return count;
    }

    function _itemLength(uint256 memPtr) private pure returns (uint256 len) {
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            return 1;
        } else if (byte0 < STRING_LONG_START) {
            return byte0 - STRING_SHORT_START + 1;
        } else if (byte0 < LIST_SHORT_START) {
            assembly {
                let byteLen := sub(byte0, 0xb7) // # of bytes the actual length is
                memPtr := add(memPtr, 1) // skip over the first byte

            /* 32 byte word size */
                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to get the len
                len := add(dataLen, add(byteLen, 1))
            }
        } else if (byte0 < LIST_LONG_START) {
            return byte0 - LIST_SHORT_START + 1;
        } else {
            assembly {
                let byteLen := sub(byte0, 0xf7)
                memPtr := add(memPtr, 1)

                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to the correct length
                len := add(dataLen, add(byteLen, 1))
            }
        }
    }

    function _payloadOffset(uint256 memPtr) private pure returns (uint256) {
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            return 0;
        } else if (byte0 < STRING_LONG_START || (byte0 >= LIST_SHORT_START && byte0 < LIST_LONG_START)) {
            return 1;
        } else if (byte0 < LIST_SHORT_START) {  // being explicit
            return byte0 - (STRING_LONG_START - 1) + 1;
        } else {
            return byte0 - (LIST_LONG_START - 1) + 1;
        }
    }

    // solium-disable security/no-assign-params
    function _copy(uint256 src, uint256 dest, uint256 len) private pure {
        // copy as many word sizes as possible
        for (; len >= WORD_SIZE; len -= WORD_SIZE) {
            assembly {
                mstore(dest, mload(src))
            }

            src += WORD_SIZE;
            dest += WORD_SIZE;
        }

        // left over bytes. Mask is used to remove unwanted bytes from the word
        uint256 mask = 256 ** (WORD_SIZE - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask)) // zero out src
            let destpart := and(mload(dest), mask) // retrieve the bytes
            mstore(dest, or(destpart, srcpart))
        }
    }
}

library TrieProof {
    using RLP for RLP.RLPItem;
    using RLP for bytes;

    bytes32 internal constant EMPTY_TRIE_ROOT_HASH = 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421;

    // decoding from compact encoding (hex prefix encoding on the yellow paper)
    function decodeNibbles(bytes memory compact, uint256 skipNibbles)
    internal
    pure
    returns (bytes memory nibbles)
    {
        require(compact.length > 0); // input > 0

        uint256 length = compact.length * 2; // need bytes, compact uses nibbles
        require(skipNibbles <= length);
        length -= skipNibbles;

        nibbles = new bytes(length);
        uint256 nibblesLength = 0;

        for (uint256 i = skipNibbles; i < skipNibbles + length; i += 1) {
            if (i % 2 == 0) {
                nibbles[nibblesLength] = bytes1(
                    (uint8(compact[i / 2]) >> 4) & 0xF
                );
            } else {
                nibbles[nibblesLength] = bytes1(
                    (uint8(compact[i / 2]) >> 0) & 0xF
                );
            }
            nibblesLength += 1;
        }

        assert(nibblesLength == nibbles.length);
    }

    function merklePatriciaCompactDecode(bytes memory compact)
    internal
    pure
    returns (bool isLeaf, bytes memory nibbles)
    {
        require(compact.length > 0, "Empty");

        uint256 first_nibble = (uint8(compact[0]) >> 4) & 0xF;
        uint256 skipNibbles;

        if (first_nibble == 0) {
            skipNibbles = 2;
            isLeaf = false;
        } else if (first_nibble == 1) {
            skipNibbles = 1;
            isLeaf = false;
        } else if (first_nibble == 2) {
            skipNibbles = 2;
            isLeaf = true;
        } else if (first_nibble == 3) {
            skipNibbles = 1;
            isLeaf = true;
        } else {
            // Not supposed to happen!
            revert("failed decoding Trie");
        }

        return (isLeaf, decodeNibbles(compact, skipNibbles));
    }

    function isEmptyByteSequence(RLP.RLPItem memory item)
    internal
    pure
    returns (bool)
    {
        if (item.len != 1) {
            return false;
        }
        uint8 b;
        uint256 memPtr = item.memPtr;
        assembly {
            b := byte(0, mload(memPtr))
        }
        return b == 0x80; /* empty byte string */
    }

    function sharedPrefixLength(
        uint256 xsOffset,
        bytes memory xs,
        bytes memory ys
    ) internal pure returns (uint256) {
        uint256 i;
        for (i = 0; i + xsOffset < xs.length && i < ys.length; i++) {
            if (xs[i + xsOffset] != ys[i]) {
                return i;
            }
        }
        return i;
    }

    /// @dev Computes the hash of the Merkle-Patricia-Trie hash of the input.
    ///      Merkle-Patricia-Tries use a hash function that outputs
    ///      *variable-length* hashes: If the input is shorter than 32 bytes,
    ///      the MPT hash is the input. Otherwise, the MPT hash is the
    ///      Keccak-256 hash of the input.
    ///      The easiest way to compare variable-length byte sequences is
    ///      to compare their Keccak-256 hashes.
    /// @param input The byte sequence to be hashed.
    /// @return Keccak-256(MPT-hash(input))
    function mptHashHash(bytes memory input) internal pure returns (bytes32) {
        if (input.length < 32) {
            return keccak256(input);
        } else {
            return
            keccak256(abi.encodePacked(keccak256(abi.encodePacked(input))));
        }
    }

    /// @dev Validates a Merkle-Patricia-Trie proof.
    ///      If the proof proves the inclusion of some key-value pair in the
    ///      trie, the value is returned. Otherwise, i.e. if the proof proves
    ///      the exclusion of a key from the trie, an empty byte array is
    ///      returned.
    /// @param siblings is the stack of MPT nodes (starting with the root) that need to be traversed during verification.
    /// @param rootHash is the Keccak-256 hash of the root node of the MPT
    /// @param key is the key of the node whose inclusion/exclusion we are proving.
    /// @return value whose inclusion is proved or an empty byte array for a proof of exclusion
    function verify(
        bytes memory siblings, // proofs
        bytes32 rootHash,
        bytes32 key
    ) internal pure returns (bytes memory value) {
        // copy key for convenience
        bytes memory decoded_key = new bytes(32);
        assembly {
            mstore(add(decoded_key, 0x20), key)
        }
        // key consisting on nibbles
        decoded_key = decodeNibbles(decoded_key, 0);

        // siblings to RLP encoding list
        RLP.RLPItem[] memory rlpSiblings = siblings.toRLPItem().toList();
        bytes memory rlpNode;
        bytes32 nodeHashHash;
        RLP.RLPItem[] memory node;
        RLP.RLPItem memory rlpValue;

        uint256 keyOffset = 0; // Offset of the proof

        // if not siblings the root hash is the hash of an empty trie
        if (rlpSiblings.length == 0) {
            // Root hash of empty tx trie
            require(rootHash == EMPTY_TRIE_ROOT_HASH, "Bad empty proof");
            return new bytes(0);
        }

        // Traverse stack of nodes starting at root.
        for (uint256 i = 0; i < rlpSiblings.length; i++) {
            // We use the fact that an rlp encoded list consists of some
            // encoding of its length plus the concatenation of its
            // *rlp-encoded* items.
            rlpNode = rlpSiblings[i].toRLPBytes();

            // The root node is hashed with Keccak-256
            if (i == 0 && rootHash != keccak256(rlpNode)) {
                revert("bad first proof part");
            }
            // All other nodes are hashed with the MPT hash function.
            if (i != 0 && nodeHashHash != mptHashHash(rlpNode)) {
                revert("bad hash");
            }

            node = rlpSiblings[i].toList();

            // Extension or Leaf node
            if (node.length == 2) {
                bool isLeaf;
                bytes memory nodeKey;
                (isLeaf, nodeKey) = merklePatriciaCompactDecode(
                    node[0].toBytes()
                );

                uint256 prefixLength = sharedPrefixLength(
                    keyOffset,
                    decoded_key,
                    nodeKey
                );
                keyOffset += prefixLength;

                if (prefixLength < nodeKey.length) {
                    // Proof claims divergent extension or leaf. (Only
                    // relevant for proofs of exclusion.)
                    // An Extension/Leaf node is divergent if it "skips" over
                    // the point at which a Branch node should have been had the
                    // excluded key been included in the trie.
                    // Example: Imagine a proof of exclusion for path [1, 4],
                    // where the current node is a Leaf node with
                    // path [1, 3, 3, 7]. For [1, 4] to be included, there
                    // should have been a Branch node at [1] with a child
                    // at 3 and a child at 4.

                    // Sanity check
                    if (i < rlpSiblings.length - 1) {
                        // divergent node must come last in proof
                        revert("divergent node must come last in proof");
                    }
                    return new bytes(0);
                }

                if (isLeaf) {
                    // Sanity check
                    if (i < rlpSiblings.length - 1) {
                        // leaf node must come last in proof
                        revert("leaf must come last in proof");
                    }

                    if (keyOffset < decoded_key.length) {
                        return new bytes(0);
                    }

                    rlpValue = node[1];
                    return rlpValue.toBytes();
                } else {
                    // extension node
                    // Sanity check
                    if (i == rlpSiblings.length - 1) {
                        // should not be at last level
                        revert("extension node cannot be at last level");
                    }

                    if (!node[1].isList()) {
                        // rlp(child) was at least 32 bytes. node[1] contains
                        // Keccak256(rlp(child)).
                        nodeHashHash = keccak256(node[1].toBytes());
                    } else {
                        // rlp(child) was at less than 32 bytes. node[1] contains
                        // rlp(child).
                        nodeHashHash = keccak256(node[1].toRLPBytes());
                    }
                }
            } else if (node.length == 17) {
                // Branch node
                if (keyOffset != decoded_key.length) {
                    // we haven't consumed the entire path, so we need to look at a child
                    uint8 nibble = uint8(decoded_key[keyOffset]);
                    keyOffset += 1;
                    if (nibble >= 16) {
                        // each element of the path has to be a nibble
                        revert("if branch node each element has to be a nibble");
                    }

                    if (isEmptyByteSequence(node[nibble])) {
                        // Sanity
                        if (i != rlpSiblings.length - 1) {
                            // leaf node should be at last level
                            revert("leaf nodes only at last level");
                        }
                        return new bytes(0);
                    } else if (!node[nibble].isList()) {
                        nodeHashHash = keccak256(node[nibble].toBytes());
                    } else {
                        nodeHashHash = keccak256(node[nibble].toRLPBytes());
                    }
                } else {
                    // we have consumed the entire mptKey, so we need to look at what's contained in this node.
                    // Sanity

                    if (i != rlpSiblings.length - 1) {
                        // should be at last level
                        revert("should be at last level");
                    }
                    return node[16].toBytes();
                }
            }
        }
    }
}

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/// @notice The `ITokenStorageProof` interface defines the standard methods that allow checking ERC token balances.
interface ITokenStorageProof {
    /// @notice Checks that the given contract is an ERC token, check the balance of the holder and registers the token
    function registerToken(address tokenAddress, uint256 balanceMappingPosition) external;

    /// @notice Sets an unverified balanceMappingPosition of the given token address
    function setBalanceMappingPosition(address tokenAddress, uint256 balanceMappingPosition) external;

    /// @notice Validates that the balance of the sender matches the one obtained from the storage position and updates the balance mapping position
    function setVerifiedBalanceMappingPosition(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof) external;

    /// @notice Determines whether the given address is registered as an ERC token contract
    function isRegistered(address tokenAddress) external view returns (bool);

    /// @notice Determines how many tokens are registered
    function tokenCount() external view returns(uint32);

    // EVENTS
    event BalanceMappingPositionUpdated(address tokenAddress, uint256 balanceMappingPosition);
}

contract TokenStorageProof is ITokenStorageProof {

    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using TrieProof for bytes;

    uint8 private constant ACCOUNT_STORAGE_ROOT_INDEX = 2;

    string private constant ERROR_BLOCKHASH_NOT_AVAILABLE = "BLOCKHASH_NOT_AVAILABLE";
    string private constant ERROR_INVALID_BLOCK_HEADER = "INVALID_BLOCK_HEADER";
    string private constant ERROR_UNPROCESSED_STORAGE_ROOT = "UNPROCESSED_STORAGE_ROOT";
    string private constant ERROR_NOT_A_CONTRACT = "NOT_A_CONTRACT";
    string private constant ERROR_NOT_ENOUGH_FUNDS = "NOT_ENOUGH_FUNDS";
    string private constant ERROR_ALREADY_REGISTERED = "ALREADY_REGISTERED";
    string private constant ERROR_NOT_REGISTERED = "NOT_REGISTERED";
    string private constant ERROR_ALREADY_VERIFIED = "ALREADY_VERIFIED";
    string private constant ERROR_INVALID_ADDRESS = "INVALID_ADDRESS";
    string private constant ERROR_SAME_VALUE = "SAME_VALUE";
    string private constant ERROR_MISMATCH_VALUE = "MISMATCH_VALUE";

    modifier onlyHolder(address tokenAddress) {
        _isHolder(tokenAddress, msg.sender);
        _;
    }

    struct ERC20Token {
        bool registered;
        bool verified;
        uint256 balanceMappingPosition;
    }

    mapping(address => ERC20Token) public tokens;
    address[] public tokenAddresses;

    function registerToken(address tokenAddress, uint256 balanceMappingPosition) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token not already registered
        require(!tokens[tokenAddress].registered, ERROR_ALREADY_REGISTERED);
        
        // Register token
        ERC20Token memory newToken;
        newToken.registered = true;
        newToken.balanceMappingPosition = balanceMappingPosition;
        tokenAddresses.push(tokenAddress);
        tokens[tokenAddress] = newToken;
    }

    function tokenCount() public view override returns(uint32) {
        return uint32(tokenAddresses.length);
    }

    function setVerifiedBalanceMappingPosition(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof
    ) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token is registered
        require(tokens[tokenAddress].registered, ERROR_NOT_REGISTERED);

        // Check token is not verified
        require(!tokens[tokenAddress].verified, ERROR_ALREADY_VERIFIED);
        
        // Get storage root
        bytes32 root = _processStorageRoot(tokenAddress, blockNumber, blockHeaderRLP, accountStateProof);
        
        // Check balance using the computed storage root and the provided proofs
        uint256 balanceFromTrie = _getBalance(
            msg.sender,
            storageProof,
            root,
            balanceMappingPosition
        );

        // Check balance obtained from the proof matches with the balanceOf call
        require(balanceFromTrie == IERC20(tokenAddress).balanceOf(msg.sender), ERROR_MISMATCH_VALUE);
        
        // Modify storage
        tokens[tokenAddress].verified = true;
        tokens[tokenAddress].balanceMappingPosition = balanceMappingPosition;
        
        // Emit event
        emit BalanceMappingPositionUpdated(tokenAddress, balanceMappingPosition);
    }

    function setBalanceMappingPosition(address tokenAddress, uint256 balanceMappingPosition) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token registered
        require(tokens[tokenAddress].registered, ERROR_NOT_REGISTERED);
        
        // Check token not already verified
        require(!tokens[tokenAddress].verified, ERROR_ALREADY_VERIFIED);
        
        // Check not same balance mapping position
        require(tokens[tokenAddress].balanceMappingPosition != balanceMappingPosition, ERROR_SAME_VALUE);
        
        // Modify storage
        tokens[tokenAddress].balanceMappingPosition = balanceMappingPosition;
        
        // Emit event
        emit BalanceMappingPositionUpdated(tokenAddress, balanceMappingPosition);
    }


    function isRegistered(address tokenAddress) external view override returns (bool) {
        return tokens[tokenAddress].registered;
    }
    
    function _isHolder(address tokenAddress, address holder) internal view {
        // check msg.sender balance calling 'balanceOf' function on the ERC20 contract
       require (IERC20(tokenAddress).balanceOf(holder) > 0, ERROR_NOT_ENOUGH_FUNDS);
    }

    function _processStorageRoot(
        address tokenAddress,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof
    )
        internal view returns (bytes32 accountStorageRoot)
    {
        bytes32 blockHash = blockhash(blockNumber);
        // Before Constantinople only the most recent 256 block hashes are available
        require(blockHash != bytes32(0), ERROR_BLOCKHASH_NOT_AVAILABLE);

        // The path for an account in the state trie is the hash of its address
        bytes32 accountProofPath = keccak256(abi.encodePacked(tokenAddress));

        // Get the account state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes32 stateRoot = _getStateRoot(blockHeaderRLP, blockHash);
        bytes memory accountRLP = accountStateProof.verify(stateRoot, accountProofPath);

        // Extract the storage root from the account node and convert to bytes32
        accountStorageRoot = bytes32(accountRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint());
    }

    function _getBalance(
        address holder,
        bytes memory storageProof,
        bytes32 root,
        uint256 balanceMappingPosition
    )
        internal pure returns (uint256)
    {
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);
        // The path for a storage value is the hash of its slot
        bytes32 slot = _getHolderBalanceSlot(holder, balanceMappingPosition);
        bytes32 storageProofPath = keccak256(abi.encodePacked(slot));

        bytes memory value;
        value = TrieProof.verify(storageProof, root, storageProofPath);

        return value.toRLPItem().toUint();
    }

    function _getHolderBalanceSlot(address holder, uint256 balanceMappingPosition) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(uint256(holder)), balanceMappingPosition));
    }

    /**
    * @dev Extract state root from block header, verifying block hash
    */
    function _getStateRoot(bytes memory blockHeaderRLP, bytes32 blockHash) internal pure returns (bytes32 stateRoot) {
        require(blockHeaderRLP.length > 123, ERROR_INVALID_BLOCK_HEADER); // prevent from reading invalid memory
        require(keccak256(blockHeaderRLP) == blockHash, ERROR_INVALID_BLOCK_HEADER);
        // 0x7b = 0x20 (length) + 0x5b (position of state root in header, [91, 123])
        assembly { stateRoot := mload(add(blockHeaderRLP, 0x7b)) }
    }
    
    /// [ADRIA] ===============================================================================

    function _getMappingValueSlot(uint256 key, uint256 mappingPosition) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(key), mappingPosition));
    }


    function _getValue(
        uint256 key,
        bytes memory storageProof,
        bytes32 root,
        uint256 mappingPosition
    )
        internal pure returns (uint256)
    {
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);
        // The path for a storage value is the hash of its slot
        bytes32 slot = _getMappingValueSlot(key, mappingPosition);
        bytes32 storageProofPath = keccak256(abi.encodePacked(slot));

        bytes memory value;
        value = TrieProof.verify(storageProof, root, storageProofPath);

        return value.toRLPItem().toUint();
    }



    function getERC20Balance(
        address holder,
	address tokenAddress,
        uint256 balanceMappingPosition,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof
    ) public view returns (uint256) {

        /// ---- copied from _processStorageRoot
        // The path for an account in the state trie is the hash of its address
        bytes32 accountProofPath = keccak256(abi.encodePacked(tokenAddress));

        // Get the account state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes32 stateRoot = _getStateRoot(blockHeaderRLP, keccak256(blockHeaderRLP));
        bytes memory accountRLP = accountStateProof.verify(stateRoot, accountProofPath);

        // Extract the storage root from the account node and convert to bytes32
        bytes32 root = bytes32(accountRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint());

        return _getBalance(holder, storageProof, root, balanceMappingPosition);
    }
    
    function getValueOf(
        uint256 key,
	address _contract,
        uint256 mappingPosition,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof
    ) public view returns (uint256) {

        /// ---- copied from _processStorageRoot
        // The path for an account in the state trie is the hash of its address
        bytes32 accountProofPath = keccak256(abi.encodePacked(_contract));

        // Get the account state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes32 stateRoot = _getStateRoot(blockHeaderRLP, keccak256(blockHeaderRLP));
        bytes memory accountRLP = accountStateProof.verify(stateRoot, accountProofPath);

        // Extract the storage root from the account node and convert to bytes32
        bytes32 root = bytes32(accountRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint());

        return _getValue(key, storageProof, root, mappingPosition);
    }
    
}

