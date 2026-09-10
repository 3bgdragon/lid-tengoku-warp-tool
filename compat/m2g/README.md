# M2G 1.1.0 compatibility

The bytecode builder, package codec and MIT LZO dependency are copied from
`3bgdragon/let-it-die-m2g-knife-only` commit `db58fbffa956e021e09ea848d4ccc4e4c88dbb4a`.
No external install, Python, or game payload is required. Included code uses Node.js built-ins.

For Steam build 25136512, `profiles.json` contains hashes and the two original 16-byte compression-directory records for each of eight supported guard/warp combinations. These are structural metadata, not full game packages. Recognition checks SHA-1; transformations additionally check full SHA-256 before and after stripping/rebuilding M2G.

To toggle warp with M2G already installed: reconstruct the exact recognized pre-M2G package, apply the existing verified warp byte patch, then regenerate M2G with the same Node.js builder. The expected final hashes are fixed, independently enumerated profiles. Unknown variants fail closed.

This handles M2G Node.js v1.1.0. The archived Python v1.0.0 compressor produces different files and is not implicitly accepted. Whole-backup restoration is still a whole-backup operation; it is not selective removal of a mod.
