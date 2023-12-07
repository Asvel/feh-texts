/*!
  Based on https://github.com/DanTheMan827/node-lz11/blob/master/lz11.js
*/
/*!
  Copyright 2017, Daniel Radtke (DanTheMan827)

  Permission to use, copy, modify, and/or distribute this software for any
  purpose with or without fee is hereby granted, provided that the above
  copyright notice and this permission notice appear in all copies.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
  WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
  MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
  ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
  WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
  ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
  OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
/*!
  Based on the work by mtheall located at
  https://github.com/mtheall/decompress/
*/

function decompress(inputBuffer) {
  let readOffset = 0
  let writeOffset = 0
  let size = inputBuffer.readUIntLE(0x1, 0x3)

  let src = inputBuffer.slice(4)
  let dst = Buffer.alloc(size)
  while (size > 0) {
    // read in the flags data
    // from bit 7 to bit 0, following blocks:
    //     0: raw byte
    //     1: compressed block
    let flags = src[readOffset++]
    for (let i = 0; i < 8 && size > 0; i++, flags = flags << 1) {
      if ((flags & 0x80) !== 0) { // compressed blocks
        let len = 0  // length
        let disp = 0 // displacement
        switch (src[readOffset] >> 4) {
          case 0: // extended block
            len = src[readOffset++] << 4
            len = len | (src[readOffset] >> 4)
            len = len + 0x11
            break
          case 1: // extra extended block
            len = (src[readOffset++] & 0x0f) << 12
            len = len | src[readOffset++] << 4
            len = len | (src[readOffset] >> 4)
            len = len + 0x111
            break
          default: // normal block
            len = (src[readOffset] >> 4) + 1
        }

        disp = (src[readOffset++] & 0x0f) << 8
        disp = disp | src[readOffset++]

        size -= len

        // for len, copy data from the displacement
        // to the current buffer position
        for (let _ = 0; _ < len; _++) {
          dst[writeOffset++] = dst[writeOffset - disp - 2]
        }
      } else { // uncompressed block
        dst[writeOffset++] = src[readOffset++]
        size--
      }
    }
  }
  return dst
}

module.exports = { decompress };
