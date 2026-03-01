"use client";

import { useState, useCallback, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { WalletProvider, useWallet } from "@/lib/wallet-context";
import { PaymentModal } from "@/components/admin/PaymentModal";
import { setWalletPaymentResolver } from "@/lib/api";
import { sendUsdcTransfer, getProvider, type PaymentProof } from "@/lib/wallet";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();

  // Payment modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProps, setModalProps] = useState<{
    amount: string;
    receiver: string;
    currencyAddress: string;
    endpoint: string;
  } | null>(null);
  const [modalStatus, setModalStatus] = useState<
    "pending" | "signing" | "confirming" | "success" | "error"
  >("pending");
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalTxHash, setModalTxHash] = useState<string | null>(null);
  // Store resolve fn wrapped in object to avoid React setState(fn) gotcha
  const [resolveRef, setResolveRef] = useState<{
    resolve: (proof: PaymentProof | null) => void;
  } | null>(null);

  // Register/unregister wallet payment resolver
  useEffect(() => {
    if (!address) {
      setWalletPaymentResolver(null);
      return;
    }

    setWalletPaymentResolver((paymentInfo) => {
      return new Promise<PaymentProof | null>((resolve) => {
        setModalProps(paymentInfo);
        setModalStatus("pending");
        setModalError(null);
        setModalTxHash(null);
        setModalOpen(true);
        setResolveRef({ resolve });
      });
    });

    return () => setWalletPaymentResolver(null);
  }, [address]);

  const handleApprove = useCallback(async () => {
    const eth = getProvider();
    if (!modalProps || !eth || !resolveRef) return;
    try {
      setModalStatus("signing");
      const result = await sendUsdcTransfer({
        provider: eth,
        to: modalProps.receiver,
        amount: modalProps.amount,
        usdcAddress: modalProps.currencyAddress,
      });
      setModalTxHash(result.txHash);
      setModalStatus("success");

      const proof: PaymentProof = {
        txHash: result.txHash,
        from: result.from,
        amount: modalProps.amount,
        timestamp: Math.floor(Date.now() / 1000),
      };
      setTimeout(() => {
        setModalOpen(false);
        resolveRef.resolve(proof);
      }, 1500);
    } catch (e: any) {
      setModalStatus("error");
      setModalError(e?.message || "Transaction failed");
    }
  }, [modalProps, resolveRef]);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    resolveRef?.resolve(null);
  }, [resolveRef]);

  return (
    <>
      <div className="pt-24 pb-20 px-6">
        <div className="mx-auto max-w-7xl flex gap-10">
          <AdminSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      {modalOpen && modalProps && (
        <PaymentModal
          amount={modalProps.amount}
          receiver={modalProps.receiver}
          endpoint={modalProps.endpoint}
          onApprove={handleApprove}
          onCancel={handleCancel}
          status={modalStatus}
          error={modalError}
          txHash={modalTxHash}
        />
      )}
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <AdminShell>{children}</AdminShell>
    </WalletProvider>
  );
}
