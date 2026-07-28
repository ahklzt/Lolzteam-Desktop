import { useAvatarOverride } from "~/lib/avatar";

export const Avatar = ({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className: string;
}) => {
  const override = useAvatarOverride();
  const src = override ?? url;
  return src ? (
    <img
      className={className}
      style={{ borderRadius: "var(--avatar-radius, 50%)" }}
      src={src}
      alt=""
    />
  ) : (
    <div
      className={className}
      style={{ borderRadius: "var(--avatar-radius, 50%)" }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
};
