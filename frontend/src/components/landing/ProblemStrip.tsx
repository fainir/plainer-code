import { useScrollReveal } from './useScrollReveal';

export default function ProblemStrip() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 bg-gray-50 border-y border-gray-100">
      <div
        ref={ref}
        className={`max-w-4xl mx-auto px-6 text-center transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <p className="text-lg sm:text-xl text-gray-500 leading-relaxed">
          You use <span className="text-gray-800 font-semibold">Drive</span> for storage,{' '}
          <span className="text-gray-800 font-semibold">Sheets</span> for data,{' '}
          <span className="text-gray-800 font-semibold">Notion</span> for views, and{' '}
          <span className="text-gray-800 font-semibold">ChatGPT</span> on the side.
          <br />
          <span className="text-indigo-600 font-semibold">
            What if you could just describe what you need and the AI builds it?
          </span>
        </p>
      </div>
    </section>
  );
}
