interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  ref?: React.Ref<HTMLVideoElement>;
  src: string;
}

export default function Video(props: VideoProps) {
  return (
    <video
      autoPlay
      controls={false}
      loop
      muted
      playsInline
      preload="metadata"
      {...props}
    />
  );
}
