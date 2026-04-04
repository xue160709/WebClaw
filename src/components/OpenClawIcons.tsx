import React from 'react';

type IconProps = {
  className?: string;
};

function SvgIcon({
  className,
  children,
  viewBox = '0 0 24 24',
}: React.PropsWithChildren<{
  className?: string;
  viewBox?: string;
}>) {
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </SvgIcon>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M15 4h5v5" />
      <path d="M20 4 14 10" />
      <path d="M9 20H4v-5" />
      <path d="M4 20 10 14" />
    </SvgIcon>
  );
}

export function CollapseIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M14 10 20 4" />
      <path d="M20 9V4h-5" />
      <path d="m10 14-6 6" />
      <path d="M9 20H4v-5" />
    </SvgIcon>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-1.41 1.41a5 5 0 0 0 7.07 7.07L14 18.07" />
    </SvgIcon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </SvgIcon>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 12h12" />
      <path d="m12 6 6 6-6 6" />
    </SvgIcon>
  );
}
