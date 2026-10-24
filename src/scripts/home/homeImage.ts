const decodedImages = new Map<string, Promise<HTMLImageElement>>();

export function getBackgroundImageUrl(
  element: HTMLElement
): string | undefined {
  const backgroundImage = getComputedStyle(element).backgroundImage;
  const match = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
  if (!match) return undefined;

  try {
    return new URL(match[1], document.baseURI).href;
  } catch {
    return undefined;
  }
}

export function loadDecodedImage(url: string): Promise<HTMLImageElement> {
  const cachedImage = decodedImages.get(url);
  if (cachedImage) return cachedImage;

  const image = new Image();
  image.decoding = "async";
  image.src = url;
  const decodedImage = image.decode().then(() => image);
  decodedImages.set(url, decodedImage);
  decodedImage.catch(() => decodedImages.delete(url));
  return decodedImage;
}
