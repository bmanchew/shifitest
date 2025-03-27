{pkgs}: {
  deps = [
    pkgs.ffmpeg
    pkgs.xsimd
    pkgs.libxcrypt
    pkgs.ffmpeg-full
    pkgs.libsndfile
    pkgs.pkg-config
    pkgs.postgresql
    pkgs.jq
  ];
}
