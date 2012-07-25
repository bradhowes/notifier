
let COUNT=1
while ((COUNT < 100)); do
    bash post.sh br.howes 200 PLANET Foo COUNT ${COUNT}
    let COUNT+=1
    sleep 1
done
