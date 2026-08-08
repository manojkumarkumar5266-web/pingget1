/** Subtle atmospheric wash — logos removed from chrome. */
export default function Watermark() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, rgba(166,179,0,0.06), transparent 45%), radial-gradient(ellipse at 80% 90%, rgba(166,179,0,0.04), transparent 40%)',
        }}
      />
    </div>
  )
}
