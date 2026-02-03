import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Package,
  Wrench,
  Users,
  Shield,
  BarChart3,
  ShoppingCart,
  ClipboardCheck,
  Zap,
  ChevronRight,
  Play,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2,
  Gauge,
  FileText,
  Calendar,
  Camera,
  Map,
  Bell,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import quickappLogo from "@/assets/quickapp-logo.png";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureModules } from "@/components/landing/FeatureModules";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { IndustrySection } from "@/components/landing/IndustrySection";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <LandingHeader />
      <HeroSection />
      <FeatureModules />
      <FeatureShowcase />
      <ComparisonTable />
      <IndustrySection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
