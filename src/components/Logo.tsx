import { Images } from '../lib/customImages'

type LogoProps = {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export default function PingGetLogo({ size = 'sm' }: LogoProps) {
  const iconSize =
    size === 'sm' ? 'h-12 w-12' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'

  return (
    <div className="flex flex-col items-center">
      <img
        src={Images.logo}
        alt=""
        className={`${iconSize} object-contain`}
        draggable={false}
      />
    </div>
  )
}
