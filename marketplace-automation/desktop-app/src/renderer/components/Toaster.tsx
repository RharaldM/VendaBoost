import { Toaster as SonnerToaster } from 'sonner'

const Toaster = () => {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          background: 'white',
          border: '1px solid #e5e7eb',
          color: '#374151'
        },
        className: 'toast',
        descriptionClassName: 'toast-description',
        actionButtonStyle: {
          background: '#3b82f6',
          color: 'white'
        },
        cancelButtonStyle: {
          background: '#6b7280',
          color: 'white'
        }
      }}
    />
  )
}

export default Toaster