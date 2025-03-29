{pkgs}: {
  deps = [
    pkgs.rustc
    pkgs.openssl
    pkgs.libiconv
    pkgs.cargo
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
