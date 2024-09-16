import SignInForm from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <>
      <div className="flex min-h-screen flex-1">
        <div className="flex w-1/2 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <SignInForm />
        </div>
        <div className="relative hidden w-1/2 lg:block">
          {/* <img
            className="absolute inset-0 h-full w-full object-cover"
            // src="https://assuranceplatform.azurewebsites.net/static/media/building-an-assurance-case-adjusted-aspect-ratio.24a4b38575eb488728ff.png"
            src="https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt=""
          /> */}
          <img className="absolute inset-0 h-full w-full object-cover"
            src="https://raw.githubusercontent.com/alan-turing-institute/turing-commons/main/docs/assets/images/illustrations/assurance-alt.jpg"
          />
        </div>
      </div>
    </>
  )
}
