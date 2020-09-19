# Downlaods TLEs and prepends the datetime at the first line of the file
# Cronjob: 5 * * * * /bin/bash /your/script/directory/download_tles.sh
wget -q -O- https://www.celestrak.com/NORAD/elements/supplemental/ | grep -oE '|<h3[^>]+>(.*)<\/h[^>]+>' | grep -oP '\d{4}.+?(?=UTC)' > /tmp/tles.txt
curl https://www.celestrak.com/NORAD/elements/supplemental/starlink.txt >> /tmp/tles.txt
mv /tmp/tles.txt /your/web/directory/tles.txt