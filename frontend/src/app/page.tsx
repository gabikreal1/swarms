import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { QuickStart } from "@/components/landing/QuickStart";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <QuickStart />
    </>
  );
}
