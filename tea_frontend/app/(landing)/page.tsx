import CTA from '@/components/demo/landing/CTA';
import Features from '@/components/demo/landing/Features';
import Footer from '@/components/demo/landing/Footer';
import Hero from '@/components/demo/landing/Hero';

const LandingPage = () => {
  return (
    <>
      <Hero />
      <Features />
      <CTA />
      {/* <FAQ /> */}
      {/* <MailingList /> */}
      <Footer />
    </>
  );
};

export default LandingPage;
