import CTA from '@/components/demo/landing/cta';
import Features from '@/components/demo/landing/features';
import Footer from '@/components/demo/landing/footer';
import Hero from '@/components/demo/landing/hero';

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
