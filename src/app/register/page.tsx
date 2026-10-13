"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerAcademy } from "@/app/actions/register-academy";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli",
  "Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

const SPORTS = [
  "Football", "Cricket", "Tennis", "Badminton", "Swimming",
  "Basketball", "Athletics", "Martial Arts", "Other"
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    academyName: "",
    sport: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    city: "",
    state: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.academyName || !formData.sport) {
        toast.error("Please fill in academy name and sport.");
        return;
      }
    }
    if (step === 2) {
      if (!formData.ownerName || !formData.phone || !formData.email || !formData.password) {
        toast.error("Please fill in all owner details.");
        return;
      }
      if (formData.password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return;
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.city || !formData.state) {
      toast.error("Please fill in city and state.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerAcademy(formData);
      if (res.success) {
        toast.success("Academy registered successfully!");
        router.push("/org");
      } else {
        toast.error(res.error || "Failed to register academy.");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Triq</h1>
        <p className="text-zinc-400">Academy Registration</p>
      </div>

      <Card className="w-full max-w-lg bg-zinc-900/40 border-zinc-800 text-zinc-100">
        <CardHeader>
          <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
            <div
              className="bg-lime-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
          <CardTitle>
            {step === 1 && "Academy Details"}
            {step === 2 && "Owner Details"}
            {step === 3 && "Location Details"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Step {step} of 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()} className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Academy Name</label>
                  <Input
                    name="academyName"
                    value={formData.academyName}
                    onChange={handleChange}
                    placeholder="e.g. Elite Football Academy"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Sport</label>
                  <select
                    name="sport"
                    value={formData.sport}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    required
                  >
                    <option value="">Select a sport</option>
                    {SPORTS.map((sport) => (
                      <option key={sport} value={sport}>{sport}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Owner Name</label>
                  <Input
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      minLength={8}
                      className="bg-zinc-950 border-zinc-800 pr-16"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-100"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">You&apos;ll use your email and this password to sign in at /login.</p>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Mumbai"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    required
                  >
                    <option value="">Select a state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address (Optional)</label>
                  <Input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Sports Arena Road"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
              </>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-zinc-800 pt-6">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={prevStep} className="bg-transparent border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-100">
              Back
            </Button>
          ) : (
            <div></div>
          )}
          
          {step < 3 ? (
            <Button type="button" onClick={nextStep} className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200">
              Next Step
            </Button>
          ) : (
            <Button 
              type="button" 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-gradient-to-r from-lime-500 to-emerald-500 text-zinc-950 hover:from-lime-600 hover:to-emerald-600 border-none"
            >
              {loading ? "Registering..." : "Complete Registration"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <div className="mt-8">
        <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
          Already have an account? Login
        </Link>
      </div>
    </div>
  );
}
