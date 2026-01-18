import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center pt-20 sm:pt-32">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] opacity-20"></div>

      <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold mb-6 animate-fade-in-up">
        Trusted by 10,000+ Patients
      </span>

      <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
        Healthcare, <br className="hidden sm:block" />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Reimagined.
        </span>
      </h1>

      <p className="text-lg sm:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
        <span className="font-semibold text-slate-800">Seva-Sangrah</span> connects you with top specialists instantly.
        Experience seamless booking and real-time updates.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <Link
          href="/book"
          className="inline-flex justify-center items-center bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 active:scale-95"
        >
          Book Appointment
        </Link>

        <Link
          href="/doctor/login"
          className="inline-flex justify-center items-center bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-semibold text-lg hover:bg-slate-50 transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          Doctor Portal
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-2 gap-8 text-center sm:grid-cols-4 sm:gap-12 opacity-80">
        <div>
          <h3 className="text-3xl font-bold text-slate-900">50+</h3>
          <p className="text-sm text-slate-500">Specialists</p>
        </div>
        <div>
          <h3 className="text-3xl font-bold text-slate-900">24/7</h3>
          <p className="text-sm text-slate-500">Support</p>
        </div>
        <div>
          <h3 className="text-3xl font-bold text-slate-900">10k+</h3>
          <p className="text-sm text-slate-500">Happy Patients</p>
        </div>
        <div>
          <h3 className="text-3xl font-bold text-slate-900">4.9</h3>
          <p className="text-sm text-slate-500">Rating</p>
        </div>
      </div>
    </div>
  );
}
