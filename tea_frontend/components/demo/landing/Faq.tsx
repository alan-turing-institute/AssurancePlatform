const faqs = [
  {
    id: 1,
    question: "What is TEA?",
    answer:
      "TEA, short for Transformative Evidential Assurance Platform, is an innovative tool designed to provide assurance and trustworthiness to your data and analyses.",
  },
  {
    id: 2,
    question: "How does TEA ensure evidential assurance?",
    answer:
      "TEA employs a robust evidential framework that tracks and verifies the integrity of data and analyses in real-time, providing a reliable foundation for decision-making.",
  },
  {
    id: 3,
    question: "Is TEA suitable for my organization?",
    answer:
      "Absolutely! TEA is designed to be versatile and adaptable, catering to the needs of various organizations across different industries. Whether you're a small startup or a large enterprise, TEA can help enhance your assurance processes.",
  },
  {
    id: 4,
    question: "Can I customize TEA to fit my workflow?",
    answer:
      "Yes, you can! TEA offers customizable workflows, allowing you to tailor the platform to align with your specific requirements and preferences.",
  },
  {
    id: 5,
    question: "How easy is it to integrate TEA into my existing systems?",
    answer:
      "Integrating TEA is straightforward and seamless. Our team provides comprehensive support to ensure a smooth integration process, minimizing disruption to your workflow.",
  },
]

export default function FAQ() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold leading-10 tracking-tight text-gray-900">Frequently asked questions</h2>
          <p className="mt-6 text-base leading-7 text-gray-600">
            Have a different question and can’t find the answer you’re looking for? Reach out to our support team by{' '}
            <a href="mailto:tea@turing.ac.uk" className="font-semibold text-indigo-600 hover:text-indigo-500">
              sending us an email
            </a>{' '}
            and we’ll get back to you as soon as we can.
          </p>
        </div>
        <div className="mt-20">
          <dl className="space-y-16 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-16 sm:space-y-0 lg:grid-cols-3 lg:gap-x-10">
            {faqs.map((faq) => (
              <div key={faq.id}>
                <dt className="text-base font-semibold leading-7 text-gray-900">{faq.question}</dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
