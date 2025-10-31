const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } = require("@solana/spl-token");

describe("seam", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.seam;
  const provider = anchor.getProvider();

  // Test accounts
  let usdcMint;
  let userUsdcAccount;
  let userCfdAccount;
  let marketUsdcVault;
  let cfdMint;

  before(async () => {
    // Create USDC mint for testing
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6 // 6 decimals like real USDC
    );

    // Create user USDC account
    userUsdcAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      provider.wallet.publicKey
    );

    // Mint 1000 USDC to user for testing
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      userUsdcAccount,
      provider.wallet.publicKey,
      1000 * 10 ** 6 // 1000 USDC with 6 decimals
    );

    // Get PDAs
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market")],
      program.programId
    );

    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      program.programId
    );

    const [cfdMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    marketUsdcVault = usdcVaultPda;
    cfdMint = cfdMintPda;
  });

  it("Initializes the program", async () => {
    const tx = await program.methods.initialize().rpc();
    console.log("Initialize transaction signature:", tx);
  });

  it("Initializes oracle mock", async () => {
    const [oraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );

    const tx = await program.methods.initOracle().accounts({
      oracleMock: oraclePda,
      admin: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    console.log("Init oracle transaction signature:", tx);
  });

  it("Updates oracle price", async () => {
    const [oraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market")],
      program.programId
    );

    const tx = await program.methods.updateOracle(new anchor.BN(1000000)).accounts({
      oracleMock: oraclePda,
      market: marketPda,
      admin: provider.wallet.publicKey,
    }).rpc();

    console.log("Update oracle transaction signature:", tx);
  });

  it("Initializes token mint", async () => {
    const [tokenMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_mint")],
      program.programId
    );

    const [cfdMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const tx = await program.methods.initTokenMint().accounts({
      tokenMint: tokenMintPda,
      mint: cfdMintPda,
      user: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("Init token mint transaction signature:", tx);
  });

  it("Initializes a market", async () => {
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market")],
      program.programId
    );

    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      program.programId
    );

    const [oraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );

    const tx = await program.methods.initMarket().accounts({
      market: marketPda,
      user: provider.wallet.publicKey,
      usdcVault: usdcVaultPda,
      usdcMint: usdcMint,
      oracleMock: oraclePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("Init market transaction signature:", tx);
  });

  it("Mints a CFD position", async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market")],
      program.programId
    );

    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      program.programId
    );

    const [cfdMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const [oraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );

    // Create user CFD account
    userCfdAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      cfdMintPda,
      provider.wallet.publicKey
    );

    const tx = await program.methods.mintCfd(
      { long: {} }, // PositionSide::Long
      new anchor.BN(100 * 10 ** 6) // 100 USDC with 6 decimals
    ).accounts({
      position: positionPda,
      market: marketPda,
      marketUsdcVault: usdcVaultPda,
      cfdMint: cfdMintPda,
      userCfdAccount: userCfdAccount,
      userUsdcAccount: userUsdcAccount,
      usdcMint: usdcMint,
      user: provider.wallet.publicKey,
      oracleMock: oraclePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    console.log("Mint CFD transaction signature:", tx);
  });

  it("Settles the market", async () => {
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market")],
      program.programId
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      program.programId
    );

    const [cfdMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const [oraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );

    const tx = await program.methods.settleMarket().accounts({
      market: marketPda,
      position: positionPda,
      marketUsdcVault: usdcVaultPda,
      cfdMint: cfdMintPda,
      userCfdAccount: userCfdAccount,
      userUsdcAccount: userUsdcAccount,
      usdcMint: usdcMint,
      user: provider.wallet.publicKey,
      oracleMock: oraclePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    console.log("Settle market transaction signature:", tx);
  });
});