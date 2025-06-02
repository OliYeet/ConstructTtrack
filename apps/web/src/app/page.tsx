import Image from 'next/image';

export default function Home() {
  return (
    <div className='grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
      <main className='flex flex-col gap-[32px] row-start-2 items-center sm:items-start'>
        <div className='flex items-center gap-4'>
          <div className='text-4xl'>🏗️</div>
          <div>
            <h1 className='text-3xl font-bold'>ConstructTrack</h1>
            <p className='text-gray-600'>
              Fiber Optic Installation Management Platform
            </p>
          </div>
        </div>

        <div className='bg-green-50 border border-green-200 rounded-lg p-4 w-full max-w-md'>
          <h2 className='text-lg font-semibold text-green-800 mb-2'>
            ✅ API & Documentation Complete
          </h2>
          <p className='text-green-700 text-sm'>
            Base API structure with comprehensive documentation, testing
            framework, and interactive guides is ready.
          </p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl'>
          <div className='border rounded-lg p-4'>
            <h3 className='font-semibold mb-2'>🔌 API Endpoints</h3>
            <ul className='text-sm space-y-1'>
              <li>
                <code className='bg-gray-100 px-1 rounded'>/api/v1/health</code>{' '}
                - Health check
              </li>
              <li>
                <code className='bg-gray-100 px-1 rounded'>/api/v1/test</code> -
                Test endpoint
              </li>
              <li>
                <code className='bg-gray-100 px-1 rounded'>
                  /api/v1/projects
                </code>{' '}
                - Projects CRUD
              </li>
            </ul>
          </div>

          <div className='border rounded-lg p-4'>
            <h3 className='font-semibold mb-2'>🛡️ Features</h3>
            <ul className='text-sm space-y-1'>
              <li>• Standardized error handling</li>
              <li>• JWT authentication</li>
              <li>• Request validation</li>
              <li>• Rate limiting</li>
              <li>• CORS support</li>
              <li>• Logging & monitoring</li>
            </ul>
          </div>
        </div>

        <div className='flex gap-4 items-center flex-col sm:flex-row'>
          <a
            className='rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto'
            href='/docs'
            rel='noopener noreferrer'
          >
            📖 API Documentation
          </a>
          <a
            className='rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto'
            href='/api/v1/health'
            target='_blank'
            rel='noopener noreferrer'
          >
            🔍 Test API
          </a>
        </div>
      </main>
      <footer className='row-start-3 flex gap-[24px] flex-wrap items-center justify-center'>
        <a
          className='flex items-center gap-2 hover:underline hover:underline-offset-4'
          href='https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
          target='_blank'
          rel='noopener noreferrer'
        >
          <Image
            aria-hidden
            src='/file.svg'
            alt='File icon'
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className='flex items-center gap-2 hover:underline hover:underline-offset-4'
          href='https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
          target='_blank'
          rel='noopener noreferrer'
        >
          <Image
            aria-hidden
            src='/window.svg'
            alt='Window icon'
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className='flex items-center gap-2 hover:underline hover:underline-offset-4'
          href='https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
          target='_blank'
          rel='noopener noreferrer'
        >
          <Image
            aria-hidden
            src='/globe.svg'
            alt='Globe icon'
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
