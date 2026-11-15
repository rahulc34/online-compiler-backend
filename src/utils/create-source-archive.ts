import tar from "tar-stream";

export interface SourceFile {
  name: string;
  content: string;
}

export const createSourceArchive = (files: SourceFile[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const archive = tar.pack();
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        reject(new Error("Invalid archive data received"));
      }
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", reject);

    for (const file of files) {
      archive.entry(
        {
          name: file.name,
          mode: 0o644,
          uid: 10001,
          gid: 10001,
          size: Buffer.byteLength(file.content, "utf8"),
        },
        file.content,
      );
    }

    archive.finalize();
  });
};
