
          
let character_parent = [
    {v:"0",t:"선택"},
    {v:"1",t:"이성1"},
    {v:"2",t:"이성2"},
    {v:"3",t:"이성3"},

    
];

function loadCharacterParent(){
    let h = [];
    character_parent.forEach(item =>{
        h.push('<option value="' + item.v + '">' + item.t + '</option>');
    });
    document.getElementById("character_parent").innerHTML = h.join("");
}


document.addEventListener("DOMContentLoaded",loadCharacterParent);     