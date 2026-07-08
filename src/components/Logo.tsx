type LogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
};

export default function PingGetLogo({
  size = "sm",
  showText = false,
}: LogoProps) {
  const iconSize =
    size === "sm"
      ? "h-12 w-12"
      : size === "lg"
      ? "h-24 w-24"
      : "h-16 w-16";

  return (
    <div className="flex flex-col items-center">
      <img
        src="/logo.png"
        alt="PingGet"
        className={'${iconSize} object-contain'}
      />

    </div>
  );
}