"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import api, { getApiErrorMessage } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "phone" | "otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const { setAuth, initialize } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    void initialize().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        setIsEntering(true);
        router.replace("/");
      }
    });
  }, [initialize, router]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post("/accounts/auth/send-otp", {
        phone: phone.trim(),
      });
      if (response.data.success) {
        setNormalizedPhone(response.data.phone || phone.trim());
        setStep("otp");
        toast.success(response.data.message || "OTP sent");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not send OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post("/accounts/auth/verify", {
        phone: normalizedPhone || phone.trim(),
        otp: otp.trim(),
      });
      if (response.data.success) {
        setAuth(response.data.user, response.data.token);
        setIsEntering(true);
        toast.success("Welcome to Pickfoo Accounts");
        router.replace("/");
        return;
      }
    } catch (error: unknown) {
      let message = "Invalid OTP";
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.message || message;
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    try {
      const response = await api.post("/accounts/auth/resend-otp", {
        phone: normalizedPhone || phone.trim(),
      });
      toast.success(response.data.message || "OTP resent");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not resend OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isEntering) {
    return (
      <div className="h-dvh bg-[#013644] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        <p className="text-sm text-white/60">Opening accounts portal…</p>
        <p className="text-xs text-white/35">Loading ledger data</p>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-[#013644] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 10%, rgba(152,227,47,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(0,80,100,0.5), transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative h-16 w-48">
              <Image
                src="/logo.png"
                alt="Pickfoo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <p className="text-[#98E32F] text-xs font-black uppercase tracking-[0.4em] -translate-y-2">
            Accounts Portal
          </p>
        </div>

        <Card className="border-white/5 bg-[#002833] text-white overflow-hidden shadow-2xl">
          <div className="h-2 bg-linear-to-r from-[#98E32F] to-[#7dbb26]" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-(family-name:--font-fraunces)">
              {step === "phone" ? "Sign in" : "Enter OTP"}
            </CardTitle>
            <CardDescription className="text-white/40">
              {step === "phone"
                ? "Use the mobile number registered by admin."
                : `OTP sent to ${normalizedPhone || phone}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={sendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-[#013644]/50 border-white/10 focus-visible:ring-[#98E32F] text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#98E32F] text-[#013644] hover:bg-[#7dbb26] font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter OTP"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="bg-[#013644]/50 border-white/10 focus-visible:ring-[#98E32F] text-white tracking-widest text-center text-lg"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#98E32F] text-[#013644] hover:bg-[#7dbb26] font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify & continue"
                  )}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-white/40 hover:text-white"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                    }}
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    className="text-[#98E32F] hover:underline disabled:opacity-40"
                    disabled={isLoading}
                    onClick={() => void resendOtp()}
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-white/30 text-xs">
          Read-only access · No mutations from this portal
        </p>
      </div>
    </div>
  );
}
