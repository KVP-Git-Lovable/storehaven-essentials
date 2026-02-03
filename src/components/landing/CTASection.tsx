import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

const benefits = [
  "All modules included",
  "Unlimited stores",
  "AI-powered insights",
  "24/7 support",
];

export function CTASection() {
  return (
    <section id="pricing" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-slate-900 to-slate-900" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3">
          Get Started Today
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
          One Platform.
          <br />
          <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-transparent bg-clip-text">
            Unlimited Potential.
          </span>
        </h2>
        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
          Stop juggling multiple tools. Give your operations team the power of a unified platform with AI-driven insights that guide them to success.
        </p>

        {/* Benefits */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="h-5 w-5 text-amber-400" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold px-8 h-14 text-lg"
          >
            Start Free Trial
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white px-8 h-14 text-lg"
          >
            Schedule Demo
          </Button>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          No credit card required • 14-day free trial • Cancel anytime
        </p>
      </div>
    </section>
  );
}
