import glob
import os
import xmltodict
import json

from PIL import Image

# Look for XML files and parses then as if they were Pascal VOC Files
base_dir = "annotations/"
image_dir = "images/"
save_dir = "output/"

# Extract image samples and save to output dir


def extractDataset(dataset):
    objs = dataset['object']
    if type(objs) is not list:
        objs = [objs]
    print("Found {} objects on image '{}'...".format(
        len(dataset['object']), dataset['filename']))

    # Open image and get ready to process
    img = Image.open(image_dir + dataset['filename'])

    try:
        os.mkdir(save_dir)
    except:
        pass

    # Run through each item and save cut image to output folder
    print(objs)
    for item in objs:
        # Convert str to integers
        label = item['name']
        current_dir = save_dir + label + '/'
        # Create output directory
        try:
            os.mkdir(current_dir)
        except:
            pass
        bndbox = dict([(a, int(b)) for (a, b) in item['bndbox'].items()])
        # Crop image
        im = img.crop((bndbox['xmin'], bndbox['ymin'],
                       bndbox['xmax'], bndbox['ymax']))
        # Save
        count = len(os.listdir(current_dir))
        im.save(current_dir + str(count+1) + '.jpg')


def main():
    # Finds all XML files on data/ and append to list
    pascal_voc_contents = []
    xmls = glob.glob(base_dir + "*.xml")
    print("Found {} files in data directory!".format(str(len(xmls))))
    for xml in xmls:
        f_handle = open(xml, 'r')
        print("Parsing file '{}'...".format(xml))
        pascal_voc_contents.append(xmltodict.parse(f_handle.read()))

    # Process each file individually
    for index in pascal_voc_contents:
        image_file = image_dir + index['annotation']['filename']
        # If there's a corresponding file in the folder,
        # process the images and save to output folder
        if os.path.isfile(image_file):
            extractDataset(index['annotation'])
        else:
            print("Image file '{}' not found, skipping file...".format(image_file))


if __name__ == '__main__':
    main()
