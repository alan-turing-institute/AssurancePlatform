import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <>
      <div className="flex min-h-screen flex-1 flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8 dark:bg-background">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* <img
            className="mx-auto h-10 w-auto"
            src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
            alt="Your Company"
          /> */}
          <h2 className="mt-6 text-center font-bold text-2xl text-foreground leading-9 tracking-tight">
            Sign Up Today!
          </h2>
        </div>

        <RegisterForm />
      </div>
    </>
  );
}
