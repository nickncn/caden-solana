import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

const idl = JSON.parse(fs.readFileSync("./target/idl/caden.json", "utf-8"));

async function testGovernance() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = new Program(idl, provider);
    const wallet = provider.wallet as anchor.Wallet;

    console.log("🗳️ Testing Governance System...\n");

    try {
        // Load configuration
        const config = JSON.parse(fs.readFileSync("./app/src/config/deployed.json", "utf-8"));
        const governancePDA = new PublicKey(config.governance);

        console.log("📋 Step 1: Fetching governance account...");
        const governanceAccount = await program.account.governance.fetch(governancePDA);
        console.log("✅ Governance found:");
        console.log("  - Proposal Count:", governanceAccount.proposalCount.toString());
        console.log("  - Quorum Threshold:", (governanceAccount.quorumThreshold.toNumber() / 1_000_000).toFixed(2), "M CADEN");
        console.log("  - Voting Period:", governanceAccount.votingPeriod.toString(), "slots");

        // Check if user has staking position
        console.log("\n📋 Step 2: Checking staking position...");
        const [stakingPositionPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_position"), wallet.publicKey.toBuffer()],
            program.programId
        );

        let hasStakingPosition = false;
        try {
            const stakingPosition = await program.account.stakingPosition.fetch(stakingPositionPDA);
            console.log("✅ Staking position found:");
            console.log("  - Staked CADEN:", (stakingPosition.cadenStaked.toNumber() / 1_000_000).toFixed(2));
            hasStakingPosition = stakingPosition.cadenStaked.toNumber() >= 1_000_000 * 1_000_000;
        } catch (err) {
            console.log("⚠️ No staking position found");
            console.log("   (Need 1M CADEN staked to create proposals)");
        }

        if (hasStakingPosition) {
            console.log("\n📋 Step 3: Creating test proposal...");

            const proposalId = governanceAccount.proposalCount;
            const [proposalPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, 'le', 8)],
                program.programId
            );

            try {
                const tx = await program.methods
                    .createProposal(
                        { changeSettlementFee: {} },
                        "Reduce Settlement Fee to 0.2%",
                        "This proposal aims to reduce the settlement fee from 0.3% to 0.2% to increase trading volume and attract more users to the platform."
                    )
                    .accounts({
                        proposal: proposalPDA,
                        governance: governancePDA,
                        stakingPosition: stakingPositionPDA,
                        proposer: wallet.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();

                console.log("✅ Proposal created:", tx);
                console.log("  - Proposal ID:", proposalId.toString());

                // Fetch the proposal
                const proposal = await program.account.governanceProposal.fetch(proposalPDA);
                console.log("  - Title:", proposal.title);
                console.log("  - Status:", Object.keys(proposal.status)[0]);
                console.log("  - Voting ends at slot:", proposal.votingEndsSlot.toString());

            } catch (err: any) {
                if (err.message.includes("already in use")) {
                    console.log("⚠️ Proposal already exists, fetching...");
                    const proposal = await program.account.governanceProposal.fetch(proposalPDA);
                    console.log("  - Existing Proposal:", proposal.title);
                } else {
                    throw err;
                }
            }

            console.log("\n📋 Step 4: Casting vote...");

            const [votePDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("vote"),
                    proposalId.toArrayLike(Buffer, 'le', 8),
                    wallet.publicKey.toBuffer()
                ],
                program.programId
            );

            try {
                const tx = await program.methods
                    .castVote({ for: {} })
                    .accounts({
                        vote: votePDA,
                        proposal: proposalPDA,
                        stakingPosition: stakingPositionPDA,
                        voter: wallet.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();

                console.log("✅ Vote cast:", tx);

                // Fetch updated proposal
                const proposal = await program.account.governanceProposal.fetch(proposalPDA);
                console.log("  - Votes For:", (proposal.votesFor.toNumber() / 1_000_000).toFixed(2), "M CADEN");
                console.log("  - Votes Against:", (proposal.votesAgainst.toNumber() / 1_000_000).toFixed(2), "M CADEN");
                console.log("  - Total Votes:", (proposal.totalVotes.toNumber() / 1_000_000).toFixed(2), "M CADEN");

            } catch (err: any) {
                if (err.message.includes("already in use")) {
                    console.log("⚠️ Already voted on this proposal");
                } else {
                    console.log("⚠️ Could not cast vote:", err.message);
                }
            }

        } else {
            console.log("\n⚠️ Skipping proposal creation (insufficient stake)");
            console.log("   To create proposals:");
            console.log("   1. Stake at least 1M CADEN tokens");
            console.log("   2. Run this script again");
        }

        console.log("\n🎉 Governance test complete!");

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

testGovernance()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

