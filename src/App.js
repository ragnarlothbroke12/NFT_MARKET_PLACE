import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';
import axios from "axios";
import './App.css';

function App() {

  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [nftName, setNftName] = useState('');
  const [nftMetadata, setNftMetadata] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // 🌟 NEW loading state

  // ✅ Cancel Listing Function
  const handleCancelListing = async (tokenId) => {
    if (!contract) return alert("Contract not initialized.");

    try {
      setIsLoading(true); // start loader
      const tx = await contract.cancelListing(tokenId);
      await tx.wait();
      alert("Listing cancelled successfully!");
      await fetchListings();
    } catch (error) {
      alert("Error cancelling listing: " + error.message);
      console.error("❌ Error:", error);
    } finally {
      setIsLoading(false); // stop loader
    }
  };

  // ✅ Buy NFT
  const handleBuyNFT = async (tokenId, price) => {
    if (!contract) return alert("Contract not initialized.");
    try {
      setIsLoading(true);
      const tx = await contract.buy(tokenId, { value: ethers.parseEther(price.toString()) });
      await tx.wait();
      alert("✅ NFT Purchased Successfully!");
      await fetchListings();
    } catch (error) {
      alert("Error purchasing NFT: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Fetch Listings
  const fetchListings = async () => {
    if (!contract) return;
    setLoadingListings(true);
    try {
      const [listingData, tokenIDs] = await contract.getAllListings();

      const listingsArray = await Promise.all(
        tokenIDs.map(async (tokenId, index) => {
          const tokenURI = await contract.tokenURI(tokenId);
          let metadata = {};
          try {
            const response = await axios.get(tokenURI);
            metadata = response.data;
          } catch (error) {
            console.error("❌ Error fetching token URI:", error);
          }

          return {
            tokenId: tokenId.toString(),
            price: ethers.formatEther(listingData[index].price),
            seller: listingData[index].seller,
            metadata,
          };
        })
      );

      setListings(listingsArray);
    } catch (error) {
      console.error("❌ Error fetching listings:", error);
    }
    setLoadingListings(false);
  };

  useEffect(() => {
    if (contract) {
      fetchListings();
    }
  }, [contract]);

  // ✅ List NFT Function
  const handleListNFT = async (e) => {
    e.preventDefault();
    if (!contract) return alert("Contract not initialized.");
    if (tokenId === '' || price === '') return alert("Enter Token ID and Price.");

    try {
      setIsLoading(true);
      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contract.listing(tokenId, priceInWei);
      await tx.wait();
      alert(`✅ NFT Listed Successfully at ${price} ETH`);
      await fetchListings();
    } catch (error) {
      alert("Error listing NFT: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Upload Image to Pinata
  const uploadImageToPinata = async (file) => {
    if (!file) return null;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxBodyLength: "Infinity",
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
          },
        }
      );

      return response.data.IpfsHash;
    } catch (error) {
      console.error("❌ Error uploading image:", error);
      return null;
    }
  };

  // ✅ Upload Metadata
  const uploadMetadataToPinata = async (name, description, imageCID) => {
    try {
      const metadata = {
        name,
        description,
        image: `https://gateway.pinata.cloud/ipfs/${imageCID}`,
      };

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
          },
        }
      );

      return response.data.IpfsHash;
    } catch (error) {
      console.error("❌ Error uploading metadata:", error);
      return null;
    }
  };

  // ✅ Mint Function
  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract) return alert("Contract not initialized.");
    if (!nftName || !nftMetadata || !imageFile) return alert("Please fill all fields.");

    try {
      setIsLoading(true);
      const imageCID = await uploadImageToPinata(imageFile);
      if (!imageCID) throw new Error("Image upload failed!");

      const metadataCID = await uploadMetadataToPinata(nftName, nftMetadata, imageCID);
      if (!metadataCID) throw new Error("Metadata upload failed!");

      const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataCID}`;
      const tx = await contract.safeMint(metadataUrl);
      const receipt = await tx.wait();
      alert("✅ NFT Minted Successfully!");
      console.log("Receipt:", receipt);
    } catch (error) {
      alert("Error minting NFT: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Connect Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(contractInstance);
      } catch (error) {
        console.error("❌ Wallet connection error:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <h1>⚡ NFT Minter & Marketplace</h1>
        {walletAddress ? (
          <div className="wallet-info">
            <span className="wallet-address">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button className="disconnect-btn" onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="connect-btn" onClick={connectWallet}>
            🔗 Connect Wallet
          </button>
        )}
      </header>

      {/* LOADING OVERLAY */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>⏳ Please wait, transaction in progress...</p>
        </div>
      )}

      {/* MINT & LIST SECTION */}
      {walletAddress && (
        <div className="main-sections">
          {/* Mint Section */}
          <section className="card mint-card">
            <h2>💎 Mint Your NFT</h2>
            <form onSubmit={handleMint}>
              <label>NFT Name</label>
              <input type="text" value={nftName} onChange={(e) => setNftName(e.target.value)} required />
              <label>Description</label>
              <textarea value={nftMetadata} onChange={(e) => setNftMetadata(e.target.value)} required></textarea>
              <label>Upload Image</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} required />
              <button type="submit" className="gradient-btn">Mint NFT 💠</button>
            </form>
          </section>

          {/* List Section */}
          <section className="card list-card">
            <h2>🛒 List NFT for Sale</h2>
            <form onSubmit={handleListNFT}>
              <label>Token ID</label>
              <input type="number" value={tokenId} onChange={(e) => setTokenId(e.target.value)} required />
              <label>Price (ETH)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
              <button type="submit" className="gradient-btn blue-btn">List NFT 🚀</button>
            </form>
          </section>
        </div>
      )}

      {/* LISTINGS SECTION */}
      {loadingListings ? (
        <p>Loading listings...</p>
      ) : (
        listings.length > 0 && (
          <section className="listings-section">
            <h2>🏷️ NFT Listings</h2>
            <div className="listings-grid">
              {listings.map((listing) => (
                <div key={listing.tokenId} className="listing-card">
                  <img src={listing.metadata.image} alt={listing.metadata.name} className="listing-image" />
                  <h3>{listing.metadata.name}</h3>
                  <p>{listing.metadata.description}</p>
                  <p className="price">💰 {listing.price} ETH</p>
                  <p className="seller">👤 {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</p>

                  {walletAddress?.toLowerCase() === listing.seller.toLowerCase() ? (
                    <button className="gradient-btn red-btn" onClick={() => handleCancelListing(listing.tokenId)}>
                      ❌ Cancel Listing
                    </button>
                  ) : (
                    <button className="gradient-btn buy-btn" onClick={() => handleBuyNFT(listing.tokenId, listing.price)}>
                      Buy NFT 🛒
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      )}

      {/* FOOTER */}
      <footer className="footer">
        <p>Built with ❤️ using React + Web3</p>
      </footer>
    </div>
  );
}

export default App;
