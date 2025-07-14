import {
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  CloudArrowUpIcon,
  FingerPrintIcon,
  LightBulbIcon,
  LockClosedIcon,
} from '@heroicons/react/20/solid';

const features = [
  {
    name: 'Structured Methodology.',
    description:
      'Our platform uses a structured methodology for assurance, supported by open and accessible user resources designed by experts in assurance.',
    icon: CloudArrowUpIcon,
  },
  {
    name: 'Best Practices.',
    description:
      'Our aim is to facilitate open sharing and communication of assurance cases, to help enable cross-sector and multi-disciplinary forms of knowledge sharing and best practice.',
    icon: LockClosedIcon,
  },
  {
    name: 'Responsible research and Innovation.',
    description:
      'Going beyond traditional goals such as safety or security, the TEA platform encourages teams to critically reflect and deliberate about the societal and ethical impact of their research and innovation practices.',
    icon: LightBulbIcon,
  },
  {
    name: 'Community Building.',
    description:
      'The TEA Platform aims to remove barriers to participation and contribution to assurance practices, seeking to build a diverse and inclusive community of practice.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Privacy and Control.',
    description:
      "Although we promote and encourage openness and transparency, we also support self-hosting to ensure that users who handle sensitive information can manage it securely and privately within their own organisation's infrastructure.",
    icon: FingerPrintIcon,
  },
  {
    name: 'Training and Capacity Building.',
    description:
      'The platform includes freely accessible training resources for a broad range of users and stakeholders, as well as providing information about upcoming events and workshops.',
    icon: AcademicCapIcon,
  },
];

export default function Features() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className="font-semibold text-base text-indigo-600 leading-7">
            Everything you need
          </h2>
          <p className="mt-2 font-bold text-3xl text-gray-900 tracking-tight sm:text-4xl">
            What TEA offers
          </p>
          {/* <p className="mt-6 text-lg leading-8 text-gray-600">
            Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste
            dolor cupiditate blanditiis.
          </p> */}
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <img
            alt="App screenshot"
            className="mb-[-12%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
            height={1442}
            src="/images/tea-chart-example2.png"
            width={2432}
          />
          <div aria-hidden="true" className="relative">
            <div className="-inset-x-20 absolute bottom-0 bg-gradient-to-t from-white pt-[7%]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base text-gray-600 leading-7 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          {features.map((feature) => (
            <div className="relative pl-9" key={feature.name}>
              <div className="inline font-semibold text-gray-900">
                <feature.icon
                  aria-hidden="true"
                  className="absolute top-1 left-1 h-5 w-5 text-indigo-600"
                />
                {feature.name}
              </div>{' '}
              <div className="inline text-pretty">
                <br />
                {feature.description}
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
