import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import ProblemStrip from '../components/landing/ProblemStrip';
import HowItWorks from '../components/landing/HowItWorks';
import FeatureAIDrive from '../components/landing/FeatureAIDrive';
import AICapabilities from '../components/landing/AICapabilities';
import FeatureMultiView from '../components/landing/FeatureMultiView';
import FeatureCustomApps from '../components/landing/FeatureCustomApps';
import FeatureMarketplace from '../components/landing/FeatureMarketplace';
import UseCases from '../components/landing/UseCases';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      <HeroSection />
      <ProblemStrip />
      <HowItWorks />
      <FeatureAIDrive />
      <AICapabilities />
      <FeatureCustomApps />
      <FeatureMultiView />
      <FeatureMarketplace />
      <UseCases />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
